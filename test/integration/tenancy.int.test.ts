import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const adapter = vi.hoisted(() => {
  let next = 1;
  return {
    createMonitor: vi.fn(async () => ({ kumaId: next++ })),
    deleteMonitor: vi.fn(async () => undefined),
    setMonitorActive: vi.fn(async () => undefined),
    getMonitorStatus: vi.fn(async () => ({ status: "up", time: new Date().toISOString(), ping: 10, message: "OK" })),
    getMonitorHistory: vi.fn(async () => []),
    ensureAlertWebhook: vi.fn(async () => 1),
  };
});
vi.mock("@/lib/uptime-kuma", () => ({ getAdapter: () => adapter }));
vi.mock("node:dns/promises", () => ({ lookup: async () => [{ address: "93.184.216.34" }] }));

import { NotFoundError, PlanLimitError, ValidationError } from "@/lib/errors";
import { savePlanConfig } from "@/lib/admin/pricing";
import { invalidatePlanConfigs } from "@/lib/plan-config";
import { prisma } from "@/lib/prisma";
import { createMonitor, createNotificationChannel, createStatusPage, deleteMonitor, getMonitorStatus } from "@/lib/uptimeKuma";
import { mkMonitor, mkUser } from "./helpers";

const http = (name: string) => ({ name, type: "HTTP" as const, url: "https://example.com", interval: 180 });

beforeEach(() => {
  vi.clearAllMocks();
  invalidatePlanConfigs();
});

describe("çok kiracılı izolasyon (gerçek veritabanı)", () => {
  it("başkasının monitörü silinemez, durumu okunamaz; sahibi silebilir", async () => {
    const a = await mkUser("PRO");
    const b = await mkUser("PRO");
    const m = await createMonitor(a.id, http("a-site"));

    await expect(deleteMonitor(b.id, m.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getMonitorStatus(b.id, m.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await prisma.monitor.count({ where: { id: m.id } })).toBe(1);
    expect(adapter.deleteMonitor).not.toHaveBeenCalled();

    await deleteMonitor(a.id, m.id);
    expect(await prisma.monitor.count({ where: { id: m.id } })).toBe(0);
    expect(adapter.deleteMonitor).toHaveBeenCalledTimes(1);
  });

  it("Free planda 5 monitörden sonra 6.'sı reddedilir; Kuma'ya gidilmez", async () => {
    const u = await mkUser("FREE");
    for (let i = 0; i < 5; i++) await createMonitor(u.id, http(`s${i}`));
    adapter.createMonitor.mockClear();
    await expect(createMonitor(u.id, http("sixth"))).rejects.toBeInstanceOf(PlanLimitError);
    expect(adapter.createMonitor).not.toHaveBeenCalled();
    expect(await prisma.monitor.count({ where: { userId: u.id } })).toBe(5);
  });

  it("admin'in değiştirdiği limit hemen uygulanır (Free 5 -> 7)", async () => {
    const u = await mkUser("FREE");
    await savePlanConfig("FREE", {
      priceMonthly: 0, priceYearly: 0, eurMonthly: null, eurYearly: null, usdMonthly: null, usdYearly: null,
      monitors: 7, minInterval: 180, statusPages: 1, customDomain: false, api: false, trialDays: 0, highlight: false, isActive: true,
    });
    for (let i = 0; i < 7; i++) await createMonitor(u.id, http(`x${i}`));
    await expect(createMonitor(u.id, http("eighth"))).rejects.toBeInstanceOf(PlanLimitError);
  });

  it("heartbeat monitörü benzersiz ping anahtarıyla kaydedilir", async () => {
    const u = await mkUser("PRO");
    const a = await createMonitor(u.id, { name: "backup", type: "HEARTBEAT", interval: 3600, grace: 600 });
    const b = await createMonitor(u.id, { name: "report", type: "HEARTBEAT", interval: 86400 });
    expect(a.pingToken).toMatch(/^[A-Za-z0-9]{32}$/);
    expect(a.pingToken).not.toBe(b.pingToken);
    expect(a).toMatchObject({ type: "HEARTBEAT", graceSeconds: 600, url: "heartbeat" });
    const kumaCall = adapter.createMonitor.mock.calls[0] as unknown as [string, { interval: number; pushToken: string }];
    expect(kumaCall[1]).toMatchObject({ interval: 4200, pushToken: a.pingToken });
  });

  it("durum sayfasına başkasının monitörü eklenemez; adres benzersizdir", async () => {
    const a = await mkUser("PRO");
    const b = await mkUser("PRO");
    const am = await mkMonitor(a.id);
    const bm = await mkMonitor(b.id);

    await expect(createStatusPage(b.id, { slug: "b-status", title: "B", monitorIds: [am.id] })).rejects.toBeInstanceOf(NotFoundError);
    expect(await prisma.statusPage.count({ where: { slug: "b-status" } })).toBe(0);

    const page = await createStatusPage(a.id, { slug: "taken-slug", title: "A", monitorIds: [am.id] });
    expect(page.slug).toBe("taken-slug");
    await expect(createStatusPage(b.id, { slug: "taken-slug", title: "B", monitorIds: [bm.id] })).rejects.toBeInstanceOf(ValidationError);
    await expect(createStatusPage(b.id, { slug: "www", title: "B" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("özel alan adı yalnızca ücretli planda ve benzersiz", async () => {
    const free = await mkUser("FREE");
    const pro = await mkUser("PRO");
    await expect(createStatusPage(free.id, { slug: "free-page", title: "F", customDomain: "status.free.com" })).rejects.toMatchObject({ limit: "customDomain" });
    await createStatusPage(pro.id, { slug: "pro-page", title: "P", customDomain: "status.pro.com" });
    const other = await mkUser("PRO");
    await expect(createStatusPage(other.id, { slug: "pro-two", title: "P2", customDomain: "status.pro.com" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("bildirim kanalı şifreli saklanır; düz metin veritabanında yok", async () => {
    const u = await mkUser("PRO");
    await createNotificationChannel(u.id, { type: "SLACK", name: "team", config: { webhookUrl: "https://hooks.slack.com/services/T0/B0/SECRET123" } });
    const row = await prisma.notificationChannel.findFirstOrThrow({ where: { userId: u.id } });
    expect(JSON.stringify(row.config)).not.toContain("SECRET123");
    expect(row.isVerified).toBe(false);
  });

  it("kullanıcı silinince tüm ilişkili veriler silinir, denetim kaydı korunur", async () => {
    const u = await mkUser("PRO");
    const m = await mkMonitor(u.id);
    await prisma.incident.create({ data: { monitorId: m.id } });
    await prisma.notificationChannel.create({ data: { userId: u.id, type: "EMAIL", name: "e", config: { enc: "x" } } });
    await prisma.apiKey.create({ data: { userId: u.id, name: "k", prefix: "upk_aaaaaaaa", hash: `h-${u.id}` } });
    await prisma.auditLog.create({ data: { userId: u.id, action: "something" } });

    await prisma.user.delete({ where: { id: u.id } });
    expect(await prisma.monitor.count({ where: { userId: u.id } })).toBe(0);
    expect(await prisma.incident.count({ where: { monitorId: m.id } })).toBe(0);
    expect(await prisma.notificationChannel.count({ where: { userId: u.id } })).toBe(0);
    expect(await prisma.apiKey.count({ where: { userId: u.id } })).toBe(0);
    const audit = await prisma.auditLog.findFirst({ where: { action: "something" } });
    expect(audit?.userId).toBeNull(); // SetNull: kayıt kalır, kullanıcı bağı kopar
  });

  it("aynı Kuma monitör kimliği iki kez eşlenemez", async () => {
    const u = await mkUser("PRO");
    await prisma.monitor.create({ data: { userId: u.id, uptimeKumaMonitorId: 777_001, name: "a", url: "https://a.com" } });
    await expect(prisma.monitor.create({ data: { userId: u.id, uptimeKumaMonitorId: 777_001, name: "b", url: "https://b.com" } })).rejects.toThrow();
  });
});

// Plan ayarlarını değiştiren testler sonrası diğer dosyalar varsayılanlarla çalışsın
afterAll(async () => {
  await prisma.planConfig.deleteMany();
  invalidatePlanConfigs();
});
