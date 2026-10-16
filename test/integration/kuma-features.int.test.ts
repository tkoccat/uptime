import { beforeEach, describe, expect, it, vi } from "vitest";

const adapter = vi.hoisted(() => {
  let next = 5000;
  return {
    createMonitor: vi.fn(async (..._a: unknown[]) => ({ kumaId: next++ })),
    updateMonitor: vi.fn(async (..._a: unknown[]) => undefined),
    deleteMonitor: vi.fn(async () => undefined),
    setMonitorActive: vi.fn(async () => undefined),
    getMonitorHistory: vi.fn(async (): Promise<{ status: string; time: string; ping: number | null; message: string | null }[]> => []),
    ensureAlertWebhook: vi.fn(async () => 1),
  };
});
vi.mock("@/lib/uptime-kuma", () => ({ getAdapter: () => adapter }));
vi.mock("node:dns/promises", () => ({ lookup: async () => [{ address: "93.184.216.34" }] }));

const email = vi.hoisted(() => ({ sendEmail: vi.fn(async (...args: unknown[]) => void args) }));
vi.mock("@/lib/email/send", () => email);

import { NotFoundError, ValidationError } from "@/lib/errors";
import { readOptions } from "@/lib/monitor-options";
import { dispatchAlert } from "@/lib/notify/dispatch";
import { prisma } from "@/lib/prisma";
import {
  createMaintenance,
  createMonitor,
  createNotificationChannel,
  deleteMaintenance,
  getMonitorChart,
  getMonitorSummaries,
  updateMonitor,
} from "@/lib/uptimeKuma";
import { mkMonitor, mkUser } from "./helpers";

beforeEach(() => vi.clearAllMocks());

const base = { name: "site", type: "HTTP" as const, url: "https://example.com", interval: 180 };

describe("monitör seçenekleri ve düzenleme", () => {
  it("gelişmiş ayarlar kaydedilir ve Kuma'ya iletilir; düzenleme ayarları günceller, türü değiştirmez", async () => {
    const u = await mkUser("PRO");
    const m = await createMonitor(u.id, {
      ...base,
      tags: ["prod", "api"],
      description: "main site",
      options: { retries: 3, acceptedStatus: ["200-299", "301"], method: "HEAD", headers: '{"X-A":"1"}' } as never,
    });
    const stored = readOptions(m.options);
    expect(stored).toMatchObject({ retries: 3, method: "HEAD", acceptedStatus: ["200-299", "301"] });
    expect(m.tags).toEqual(["prod", "api"]);
    expect((adapter.createMonitor.mock.calls[0] as unknown as [string, { options: { retries: number } }])[1].options.retries).toBe(3);

    // Düzenleme: ad/aralık/ayar değişir; gelen tür yok sayılır
    const edited = await updateMonitor(u.id, m.id, { ...base, name: "renamed", type: "PING", interval: 300, options: { retries: 0 } as never, tags: [] });
    expect(edited).toMatchObject({ name: "renamed", interval: 300, type: "HTTP", tags: [] });
    expect(readOptions(edited.options).retries).toBe(0);
    expect(adapter.updateMonitor).toHaveBeenCalledTimes(1);
  });

  it("zaman aşımı kontrol aralığından uzunsa reddedilir; başkasının monitörü düzenlenemez", async () => {
    const a = await mkUser("PRO");
    const b = await mkUser("PRO");
    await expect(createMonitor(a.id, { ...base, interval: 60, options: { timeout: 90 } as never })).rejects.toBeInstanceOf(ValidationError);
    const m = await createMonitor(a.id, base);
    await expect(updateMonitor(b.id, m.id, base)).rejects.toBeInstanceOf(NotFoundError);
    expect(adapter.updateMonitor).not.toHaveBeenCalled();
  });
});

describe("özet ve grafik verisi", () => {
  it("liste özeti son kalp atışlarını ve 30 günlük uptime'ı döner; grafik dilimlere indirger", async () => {
    const u = await mkUser("PRO");
    const m = await mkMonitor(u.id);
    const now = Date.now();
    const beat = (minsAgo: number, status: string, ping: number | null) => ({ status, time: new Date(now - minsAgo * 60_000).toISOString(), ping, message: null });
    adapter.getMonitorHistory.mockResolvedValue([beat(50, "up", 100), beat(40, "up", 200), beat(30, "down", null), beat(10, "up", 300)]);
    await prisma.monitorDaily.create({ data: { monitorId: m.id, day: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())), up: 90, down: 10 } });

    const summaries = await getMonitorSummaries(u.id);
    expect(summaries.get(m.id)!.beats).toHaveLength(4);
    expect(summaries.get(m.id)!.uptime30d).toBeCloseTo(90);

    const chart = await getMonitorChart(u.id, m.id, "24h");
    expect(chart).toMatchObject({ up: 3, down: 1, min: 100, max: 300, avg: 200 });
    expect(chart.points).toHaveLength(120);
    expect(chart.points.some((p) => p.down)).toBe(true);
    expect(chart.recent).toHaveLength(4);
  });

  it("Kuma'ya ulaşılamazsa liste özeti boş çubukla döner", async () => {
    const u = await mkUser("PRO");
    const m = await mkMonitor(u.id);
    adapter.getMonitorHistory.mockRejectedValueOnce(new Error("kuma down"));
    expect((await getMonitorSummaries(u.id)).get(m.id)!.beats).toEqual([]);
  });
});

describe("planlı bakım", () => {
  it("bakım sırasında uyarı gönderilmez ve olay açılmaz; bitince normal akış sürer", async () => {
    const u = await mkUser("PRO");
    const m = await mkMonitor(u.id);
    await createMaintenance(u.id, { title: "DB upgrade", startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3600_000), monitorIds: [m.id] });

    await dispatchAlert({ monitorId: m.id, kind: "down", message: "x", time: new Date().toISOString() });
    expect(email.sendEmail).not.toHaveBeenCalled();
    expect(await prisma.incident.count({ where: { monitorId: m.id } })).toBe(0);

    // Bakım penceresinin dışındaki bir zamanda gelen olay normal işlenir
    await dispatchAlert({ monitorId: m.id, kind: "down", message: "x", time: new Date(Date.now() + 2 * 3600_000).toISOString() });
    expect(await prisma.incident.count({ where: { monitorId: m.id } })).toBe(1);
    expect(email.sendEmail).toHaveBeenCalled();
  });

  it("geçersiz aralık, başkasının monitörü ve yetkisiz silme engellenir", async () => {
    const a = await mkUser("PRO");
    const b = await mkUser("PRO");
    const m = await mkMonitor(a.id);
    const now = Date.now();
    await expect(createMaintenance(a.id, { title: "x", startsAt: new Date(now + 5000), endsAt: new Date(now), monitorIds: [m.id] })).rejects.toBeInstanceOf(ValidationError);
    await expect(createMaintenance(b.id, { title: "x", startsAt: new Date(now), endsAt: new Date(now + 5000), monitorIds: [m.id] })).rejects.toBeInstanceOf(NotFoundError);

    const w = await createMaintenance(a.id, { title: "ok", startsAt: new Date(now), endsAt: new Date(now + 5000), monitorIds: [m.id] });
    await deleteMaintenance(b.id, w.id); // başkası silemez
    expect(await prisma.maintenance.count({ where: { id: w.id } })).toBe(1);
    await deleteMaintenance(a.id, w.id);
    expect(await prisma.maintenance.count({ where: { id: w.id } })).toBe(0);
  });
});

describe("yeni bildirim kanalları", () => {
  it("ntfy, Pushover ve Google Chat ayarları doğrulanır", async () => {
    const u = await mkUser("PRO");
    await expect(createNotificationChannel(u.id, { type: "NTFY", name: "n", config: { topic: "my-alerts", serverUrl: "", token: "" } })).resolves.toMatchObject({ type: "NTFY" });
    await expect(createNotificationChannel(u.id, { type: "NTFY", name: "n", config: { topic: "bad topic!" } })).rejects.toBeInstanceOf(ValidationError);
    await expect(createNotificationChannel(u.id, { type: "PUSHOVER", name: "p", config: { userKey: "a".repeat(30), appToken: "b".repeat(30) } })).resolves.toMatchObject({ type: "PUSHOVER" });
    await expect(createNotificationChannel(u.id, { type: "PUSHOVER", name: "p", config: { userKey: "short", appToken: "b".repeat(30) } })).rejects.toBeInstanceOf(ValidationError);
    await expect(createNotificationChannel(u.id, { type: "GOOGLE_CHAT", name: "g", config: { webhookUrl: "https://chat.googleapis.com/v1/spaces/AAA/messages?key=k&token=t" } })).resolves.toMatchObject({ type: "GOOGLE_CHAT" });
    await expect(createNotificationChannel(u.id, { type: "GOOGLE_CHAT", name: "g", config: { webhookUrl: "https://evil.example/hook" } })).rejects.toBeInstanceOf(ValidationError);
  });
});
