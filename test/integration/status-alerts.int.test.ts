import { beforeEach, describe, expect, it, vi } from "vitest";

const adapter = vi.hoisted(() => ({
  getMonitorHistory: vi.fn(async (): Promise<{ status: string; time: string; ping: number | null; message: string | null }[]> => []),
  setMonitorActive: vi.fn(async () => undefined),
}));
vi.mock("@/lib/uptime-kuma", () => ({ getAdapter: () => adapter }));

const email = vi.hoisted(() => ({ sendEmail: vi.fn(async (...args: unknown[]) => void args) }));
vi.mock("@/lib/email/send", () => email);

const channelSend = vi.hoisted(() => ({ sendToExternalChannel: vi.fn(async () => undefined) }));
vi.mock("@/lib/notify/channels", async (orig) => ({ ...(await orig<typeof import("@/lib/notify/channels")>()), ...channelSend }));

import { statusBadge, uptimeBadge } from "@/lib/badge";
import { encrypt } from "@/lib/crypto";
import { handlePing } from "@/lib/heartbeat";
import { rollupUptime } from "@/lib/jobs/handlers";
import { dispatchAlert } from "@/lib/notify/dispatch";
import { prisma } from "@/lib/prisma";
import { loadStatusPage } from "@/lib/status-page/data";
import { mkMonitor, mkUser } from "./helpers";

beforeEach(() => vi.clearAllMocks());

const day = (offset: number) => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() - offset));

describe("durum sayfası verisi", () => {
  it("yalnızca bağlı monitörler, günlük çubuklar, uptime ve olaylar döner", async () => {
    const u = await mkUser("PRO", { locale: "de", timezone: "Europe/Berlin" });
    const up = await mkMonitor(u.id, { name: "web" });
    const down = await mkMonitor(u.id, { name: "api" });
    const hidden = await mkMonitor(u.id, { name: "internal" });
    await prisma.statusPage.create({ data: { userId: u.id, slug: "acme-status", config: { title: "ACME" }, monitors: { connect: [{ id: up.id }, { id: down.id }] } } });

    await prisma.monitorDaily.createMany({
      data: [
        { monitorId: up.id, day: day(1), up: 99, down: 1 },
        { monitorId: up.id, day: day(2), up: 100, down: 0 },
        { monitorId: down.id, day: day(0), up: 10, down: 10 },
        { monitorId: hidden.id, day: day(0), up: 1, down: 1 },
      ],
    });
    await prisma.incident.create({ data: { monitorId: down.id, message: "timeout" } }); // açık olay

    const data = await loadStatusPage({ slug: "acme-status" });
    expect(data).toMatchObject({ title: "ACME", locale: "de", timezone: "Europe/Berlin" });
    expect(data!.monitors.map((m) => m.name).sort()).toEqual(["api", "web"]); // "internal" görünmez
    const web = data!.monitors.find((m) => m.name === "web")!;
    expect(web.days).toHaveLength(90);
    expect(web.uptime).toBeCloseTo((199 / 200) * 100);
    expect(data!.monitors.find((m) => m.name === "api")).toMatchObject({ isDown: true, uptime: 50 });
    expect(data!.incidents).toHaveLength(1);

    expect(statusBadge(data)).toContain("partial outage");
    expect(uptimeBadge(data)).toContain("%");
  });

  it("herkese açık olmayan sayfa ve bilinmeyen adres null döner; özel alan adı ile bulunur", async () => {
    const u = await mkUser("PRO");
    await prisma.statusPage.create({ data: { userId: u.id, slug: "private-page", isPublic: false } });
    await prisma.statusPage.create({ data: { userId: u.id, slug: "custom-page", customDomain: "status.custom-test.com" } });
    expect(await loadStatusPage({ slug: "private-page" })).toBeNull();
    expect(await loadStatusPage({ slug: "does-not-exist" })).toBeNull();
    expect(await loadStatusPage({ customDomain: "status.custom-test.com" })).not.toBeNull();
  });
});

describe("uyarı dağıtımı", () => {
  it("down olayı olay kaydı açar, e-posta gönderir; tekrarında ikinci kayıt açmaz; up olayı çözer", async () => {
    const u = await mkUser("PRO");
    const m = await mkMonitor(u.id, { name: "shop", url: "https://shop.test" });
    const t0 = new Date().toISOString();

    await dispatchAlert({ monitorId: m.id, kind: "down", message: "timeout", time: t0 });
    await dispatchAlert({ monitorId: m.id, kind: "down", message: "timeout", time: t0 });
    expect(await prisma.incident.count({ where: { monitorId: m.id } })).toBe(1);
    expect(email.sendEmail).toHaveBeenCalledTimes(2); // her down bildirimi hesap sahibine gider
    expect(email.sendEmail.mock.calls[0][0]).toBe(u.email);

    await dispatchAlert({ monitorId: m.id, kind: "up", time: new Date().toISOString() });
    const incident = await prisma.incident.findFirstOrThrow({ where: { monitorId: m.id } });
    expect(incident.resolvedAt).not.toBeNull();
  });

  it("e-posta tercihi kapalıysa hesap e-postası gitmez; yalnızca doğrulanmış kanallar bildirilir", async () => {
    const u = await mkUser("PRO", { emailPrefs: { monitor_down: false } });
    const m = await mkMonitor(u.id);
    await prisma.notificationChannel.create({ data: { userId: u.id, type: "SLACK", name: "verified", isVerified: true, config: { enc: encrypt(JSON.stringify({ webhookUrl: "https://hooks.slack.com/services/T/B/X" })) } } });
    await prisma.notificationChannel.create({ data: { userId: u.id, type: "DISCORD", name: "unverified", isVerified: false, config: { enc: encrypt(JSON.stringify({ webhookUrl: "https://discord.com/api/webhooks/1/x" })) } } });

    await dispatchAlert({ monitorId: m.id, kind: "down", message: "boom", time: new Date().toISOString() });
    expect(email.sendEmail).not.toHaveBeenCalled();
    expect(channelSend.sendToExternalChannel).toHaveBeenCalledTimes(1);
    expect((channelSend.sendToExternalChannel.mock.calls[0] as unknown as [{ name: string }])[0].name).toBe("verified");
  });

  it("bir kanal hata verse de diğerleri ve iş devam eder", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const u = await mkUser("PRO");
    const m = await mkMonitor(u.id);
    for (const name of ["a", "b"]) {
      await prisma.notificationChannel.create({ data: { userId: u.id, type: "SLACK", name, isVerified: true, config: { enc: encrypt(JSON.stringify({ webhookUrl: "https://hooks.slack.com/services/T/B/X" })) } } });
    }
    channelSend.sendToExternalChannel.mockRejectedValueOnce(new Error("slack down"));
    await expect(dispatchAlert({ monitorId: m.id, kind: "down", time: new Date().toISOString() })).resolves.toBeUndefined();
    expect(channelSend.sendToExternalChannel).toHaveBeenCalledTimes(2);
  });

  it("silinmiş monitör için olay sessizce yok sayılır", async () => {
    await expect(dispatchAlert({ monitorId: "does-not-exist", kind: "down", time: new Date().toISOString() })).resolves.toBeUndefined();
  });
});

describe("günlük uptime özeti (rollup)", () => {
  it("kalp atışlarını güne göre sayar, tekrar çalışınca çift saymaz ve su damgasını ilerletir", async () => {
    const u = await mkUser("PRO");
    const m = await mkMonitor(u.id);
    const now = Date.now();
    const beat = (minsAgo: number, status: string) => ({ status, time: new Date(now - minsAgo * 60_000).toISOString(), ping: 50, message: null });
    adapter.getMonitorHistory.mockResolvedValue([beat(30, "up"), beat(20, "up"), beat(10, "down"), beat(5, "maintenance")]);

    await rollupUptime();
    const dayKey = new Date(now - 10 * 60_000).toISOString().slice(0, 10);
    const row = await prisma.monitorDaily.findFirstOrThrow({ where: { monitorId: m.id, day: new Date(`${dayKey}T00:00:00Z`) } });
    expect(row.up + row.down).toBeGreaterThanOrEqual(3);
    const first = (await prisma.monitorDaily.findMany({ where: { monitorId: m.id } })).reduce((a, r) => a + r.up + r.down, 0);
    expect(first).toBe(3); // maintenance sayılmaz

    await rollupUptime(); // aynı kalp atışları tekrar gelir
    const second = (await prisma.monitorDaily.findMany({ where: { monitorId: m.id } })).reduce((a, r) => a + r.up + r.down, 0);
    expect(second).toBe(3);
    expect((await prisma.monitor.findUniqueOrThrow({ where: { id: m.id } })).lastRollupAt).not.toBeNull();
  });
});

describe("heartbeat ping (gerçek veritabanı)", () => {
  it("anahtar bulunur, son ping kaydedilir ve Kuma'ya iletilir", async () => {
    const u = await mkUser("PRO");
    const token = "Z".repeat(31) + String(Date.now()).slice(-1);
    const m = await mkMonitor(u.id, { type: "HEARTBEAT", url: "heartbeat", pingToken: token });
    const fetchFn = vi.fn(async (...args: unknown[]) => (void args, new Response("{}", { status: 200 })));

    expect(await handlePing({ token, failed: false, fetchFn })).toMatchObject({ status: 200 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect((await prisma.monitor.findUniqueOrThrow({ where: { id: m.id } })).lastPingAt).not.toBeNull();
    expect(await handlePing({ token: "Q".repeat(32), failed: false, fetchFn })).toMatchObject({ status: 404 });
  });
});
