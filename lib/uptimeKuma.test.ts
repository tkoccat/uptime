import { beforeEach, describe, expect, it, vi } from "vitest";

// Veritabanı ve Kuma adapter'ı taklit edilir; amaç çok kiracılı izolasyon ve limit kurallarını doğrulamaktır
const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  monitor: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), delete: vi.fn(), update: vi.fn() },
  usageLog: { create: vi.fn() },
  statusPage: { count: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  notificationChannel: { create: vi.fn() },
}));
vi.mock("./prisma", () => ({ prisma: db }));

const lookup = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({ lookup }));

const adapter = vi.hoisted(() => ({
  createMonitor: vi.fn(),
  deleteMonitor: vi.fn(),
  setMonitorActive: vi.fn(),
  getMonitorStatus: vi.fn(),
  getMonitorHistory: vi.fn(),
  ensureAlertWebhook: vi.fn(),
}));
vi.mock("./uptime-kuma", () => ({ getAdapter: () => adapter }));

import { NotFoundError, PlanLimitError, ValidationError } from "./errors";
import {
  createMonitor,
  createNotificationChannel,
  createStatusPage,
  deleteMonitor,
  getMonitorHistory,
  getMonitorStatus,
} from "./uptimeKuma";

const validInput = { name: "Site", url: "https://example.com", type: "HTTP" as const, interval: 180 };
let counter = 0;
const uid = () => `user-${++counter}`; // her testte farklı kullanıcı: hız sınırı sayaçları karışmaz

beforeEach(() => {
  vi.clearAllMocks();
  lookup.mockResolvedValue([{ address: "93.184.216.34" }]);
  db.monitor.count.mockResolvedValue(0);
  db.usageLog.create.mockResolvedValue({});
  adapter.createMonitor.mockResolvedValue({ kumaId: 99 });
  adapter.deleteMonitor.mockResolvedValue(undefined);
  db.monitor.create.mockImplementation(async ({ data }) => ({ id: "m1", ...data }));
});

describe("çok kiracılı izolasyon", () => {
  it("başkasının monitörünü silmeye çalışmak 'bulunamadı' döner ve Kuma'ya dokunmaz", async () => {
    const me = uid();
    db.monitor.findFirst.mockResolvedValue(null); // sorgu userId koşuluyla çalışır: başkasının kaydı dönmez
    await expect(deleteMonitor(me, "other-users-monitor")).rejects.toBeInstanceOf(NotFoundError);
    expect(db.monitor.findFirst).toHaveBeenCalledWith({ where: { id: "other-users-monitor", userId: me } });
    expect(adapter.deleteMonitor).not.toHaveBeenCalled();
    expect(db.monitor.delete).not.toHaveBeenCalled();
  });

  it("başkasının monitör durumu ve geçmişi okunamaz", async () => {
    const me = uid();
    db.monitor.findFirst.mockResolvedValue(null);
    await expect(getMonitorStatus(me, "x")).rejects.toBeInstanceOf(NotFoundError);
    await expect(getMonitorHistory(me, "x", "24h")).rejects.toBeInstanceOf(NotFoundError);
    expect(adapter.getMonitorStatus).not.toHaveBeenCalled();
    expect(adapter.getMonitorHistory).not.toHaveBeenCalled();
  });

  it("kendi monitörünü silince Kuma kimliğiyle adapter çağrılır", async () => {
    const me = uid();
    db.monitor.findFirst.mockResolvedValue({ id: "m1", userId: me, uptimeKumaMonitorId: 77 });
    await deleteMonitor(me, "m1");
    expect(adapter.deleteMonitor).toHaveBeenCalledWith(me, 77);
    expect(db.monitor.delete).toHaveBeenCalledWith({ where: { id: "m1" } });
  });

  it("durum sayfasına başkasının monitörü eklenemez", async () => {
    const me = uid();
    db.user.findUnique.mockResolvedValue({ id: me, plan: "PRO" });
    db.statusPage.count.mockResolvedValue(0);
    db.monitor.findMany.mockResolvedValue([]); // istenen monitör bu kullanıcıya ait değil
    await expect(
      createStatusPage(me, { slug: "my-status", title: "T", monitorIds: ["someone-elses"] })
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(db.statusPage.create).not.toHaveBeenCalled();
  });
});

describe("monitör oluşturma", () => {
  it("Free planda 5 monitör varsa 6.'sı reddedilir ve Kuma'ya gidilmez", async () => {
    const me = uid();
    db.user.findUnique.mockResolvedValue({ id: me, plan: "FREE" });
    db.monitor.count.mockResolvedValue(5);
    await expect(createMonitor(me, validInput)).rejects.toBeInstanceOf(PlanLimitError);
    expect(adapter.createMonitor).not.toHaveBeenCalled();
  });

  it("Free planda 1 dakikalık kontrol reddedilir", async () => {
    const me = uid();
    db.user.findUnique.mockResolvedValue({ id: me, plan: "FREE" });
    await expect(createMonitor(me, { ...validInput, interval: 60 })).rejects.toMatchObject({ limit: "interval" });
    expect(adapter.createMonitor).not.toHaveBeenCalled();
  });

  it("iç ağ adresi hedef olarak reddedilir (SSRF)", async () => {
    const me = uid();
    db.user.findUnique.mockResolvedValue({ id: me, plan: "PRO" });
    await expect(createMonitor(me, { ...validInput, url: "http://169.254.169.254/latest" })).rejects.toBeInstanceOf(ValidationError);
    await expect(createMonitor(me, { ...validInput, url: "http://localhost:5432" })).rejects.toBeInstanceOf(ValidationError);
    expect(adapter.createMonitor).not.toHaveBeenCalled();
  });

  it("geçersiz giriş doğrulama hatası verir", async () => {
    const me = uid();
    await expect(createMonitor(me, { ...validInput, name: "" })).rejects.toBeInstanceOf(ValidationError);
    await expect(createMonitor(me, { ...validInput, interval: 5 })).rejects.toBeInstanceOf(ValidationError);
    await expect(createMonitor(me, { ...validInput, type: "NOPE" as never })).rejects.toBeInstanceOf(ValidationError);
  });

  it("başarılı oluşturmada Kuma ve DB kayıtları eşlenir", async () => {
    const me = uid();
    db.user.findUnique.mockResolvedValue({ id: me, plan: "PRO" });
    const monitor = await createMonitor(me, validInput);
    expect(adapter.createMonitor).toHaveBeenCalledWith(me, expect.objectContaining({ target: "https://example.com", interval: 180 }));
    expect(db.monitor.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: me, uptimeKumaMonitorId: 99, name: "Site" }),
    });
    expect(monitor).toMatchObject({ id: "m1" });
  });

  it("DB yazımı başarısız olursa Kuma'daki yetim monitör temizlenir", async () => {
    const me = uid();
    db.user.findUnique.mockResolvedValue({ id: me, plan: "PRO" });
    db.monitor.create.mockRejectedValue(new Error("db down"));
    await expect(createMonitor(me, validInput)).rejects.toThrow("db down");
    expect(adapter.deleteMonitor).toHaveBeenCalledWith(me, 99);
  });

  it("dakikada 30'dan fazla ekleme/silme hız sınırına takılır", async () => {
    const me = uid();
    db.user.findUnique.mockResolvedValue({ id: me, plan: "BUSINESS" });
    db.monitor.findFirst.mockResolvedValue({ id: "m1", userId: me, uptimeKumaMonitorId: 1 });
    for (let i = 0; i < 30; i++) await deleteMonitor(me, "m1");
    await expect(deleteMonitor(me, "m1")).rejects.toMatchObject({ status: 429 });
  });
});

describe("bildirim kanalı", () => {
  it("gizli bilgiler şifreli saklanır, düz metin DB'ye yazılmaz", async () => {
    const me = uid();
    db.user.findUnique.mockResolvedValue({ id: me });
    db.notificationChannel.create.mockImplementation(async ({ data }) => ({ id: "c1", ...data }));
    await createNotificationChannel(me, {
      type: "SLACK",
      name: "Team",
      config: { webhookUrl: "https://hooks.slack.com/services/T000/B000/XXXX" },
    });
    const saved = db.notificationChannel.create.mock.calls[0][0].data;
    expect(JSON.stringify(saved.config)).not.toContain("hooks.slack.com");
    expect(saved.config.enc).toBeTruthy();
    expect(saved.isVerified).toBe(false);
  });

  it("Slack dışı adres veya geçersiz e-posta/telefon reddedilir", async () => {
    const me = uid();
    await expect(createNotificationChannel(me, { type: "SLACK", name: "x", config: { webhookUrl: "https://evil.com/x" } })).rejects.toBeInstanceOf(ValidationError);
    await expect(createNotificationChannel(me, { type: "EMAIL", name: "x", config: { email: "not-an-email" } })).rejects.toBeInstanceOf(ValidationError);
    await expect(createNotificationChannel(me, { type: "SMS", name: "x", config: { phone: "0555" } })).rejects.toBeInstanceOf(ValidationError);
  });

  it("webhook kanalı iç ağ adresine yönlendirilemez", async () => {
    const me = uid();
    await expect(createNotificationChannel(me, { type: "WEBHOOK", name: "x", config: { url: "http://10.0.0.1/hook" } })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("durum sayfası", () => {
  it("ayrılmış adresler ve özel alan adı yetkisi kontrol edilir", async () => {
    const me = uid();
    db.user.findUnique.mockResolvedValue({ id: me, plan: "FREE" });
    db.statusPage.count.mockResolvedValue(0);
    await expect(createStatusPage(me, { slug: "admin", title: "T" })).rejects.toBeInstanceOf(ValidationError);
    await expect(createStatusPage(me, { slug: "my-page", title: "T", customDomain: "status.example.com" })).rejects.toMatchObject({ limit: "customDomain" });
  });
});

describe("heartbeat (cron) monitörü", () => {
  it("adres gerekmez; ping anahtarı üretilir ve Kuma'ya push anahtarı olarak gider", async () => {
    const me = uid();
    db.user.findUnique.mockResolvedValue({ id: me, plan: "PRO" });
    const monitor = await createMonitor(me, { name: "Nightly backup", type: "HEARTBEAT", interval: 3600, grace: 300 });
    const call = adapter.createMonitor.mock.calls[0][1];
    expect(call.pushToken).toMatch(/^[A-Za-z0-9]{32}$/);
    // Kuma aralığı = beklenen aralık + tolerans
    expect(call).toMatchObject({ type: "HEARTBEAT", interval: 3900, target: "heartbeat" });
    expect(db.monitor.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ url: "heartbeat", interval: 3600, graceSeconds: 300, pingToken: call.pushToken }),
    });
    expect(monitor).toMatchObject({ id: "m1" });
    expect(lookup).not.toHaveBeenCalled(); // heartbeat için DNS/SSRF denetimi gerekmez
  });

  it("her monitörün ping anahtarı farklıdır", async () => {
    const me = uid();
    db.user.findUnique.mockResolvedValue({ id: me, plan: "PRO" });
    await createMonitor(me, { name: "a", type: "HEARTBEAT", interval: 3600 });
    await createMonitor(me, { name: "b", type: "HEARTBEAT", interval: 3600 });
    const [a, b] = adapter.createMonitor.mock.calls.map((c) => c[1].pushToken);
    expect(a).not.toBe(b);
  });

  it("çok kısa süre reddedilir; diğer türlerde adres zorunludur ve 1 günden uzun aralık olmaz", async () => {
    const me = uid();
    db.user.findUnique.mockResolvedValue({ id: me, plan: "BUSINESS" });
    await expect(createMonitor(me, { name: "x", type: "HEARTBEAT", interval: 45 })).rejects.toBeInstanceOf(ValidationError);
    await expect(createMonitor(me, { name: "x", type: "HTTP", interval: 60 })).rejects.toBeInstanceOf(ValidationError);
    await expect(createMonitor(me, { name: "x", type: "HTTP", url: "https://example.com", interval: 200_000 })).rejects.toBeInstanceOf(ValidationError);
  });

  it("Free planda heartbeat süresi plan alt sınırının altına inemez", async () => {
    const me = uid();
    db.user.findUnique.mockResolvedValue({ id: me, plan: "FREE" });
    await expect(createMonitor(me, { name: "x", type: "HEARTBEAT", interval: 60 })).rejects.toMatchObject({ limit: "interval" });
  });
});

describe("yeni bildirim kanalları doğrulaması", () => {
  const make = (type: "DISCORD" | "TEAMS" | "TELEGRAM", config: object) => createNotificationChannel(uid(), { type, name: "ch", config });
  beforeEach(() => {
    db.user.findUnique.mockResolvedValue({ id: "u" });
    db.notificationChannel.create.mockImplementation(async ({ data }) => ({ id: "c1", ...data }));
  });

  it("geçerli Discord, Teams ve Telegram ayarları kabul edilir ve şifreli saklanır", async () => {
    await make("DISCORD", { webhookUrl: "https://discord.com/api/webhooks/123456789/abc_DEF-ghi" });
    await make("TEAMS", { webhookUrl: "https://acme.webhook.office.com/webhookb2/abc/IncomingWebhook/def" });
    await make("TELEGRAM", { botToken: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef-_", chatId: "@mychannel" });
    for (const c of db.notificationChannel.create.mock.calls) {
      expect(JSON.stringify(c[0].data.config)).not.toMatch(/discord|office|telegram|ABCDEF/i);
    }
  });

  it("tanınmayan sağlayıcı adresleri ve geçersiz Telegram bilgileri reddedilir", async () => {
    await expect(make("DISCORD", { webhookUrl: "https://evil.com/api/webhooks/1/x" })).rejects.toBeInstanceOf(ValidationError);
    await expect(make("DISCORD", { webhookUrl: "http://discord.com/api/webhooks/1/x" })).rejects.toBeInstanceOf(ValidationError);
    await expect(make("TEAMS", { webhookUrl: "https://webhook.office.com.evil.com/x" })).rejects.toBeInstanceOf(ValidationError);
    await expect(make("TELEGRAM", { botToken: "nope", chatId: "1" })).rejects.toBeInstanceOf(ValidationError);
    await expect(make("TELEGRAM", { botToken: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef-_", chatId: "bad chat" })).rejects.toBeInstanceOf(ValidationError);
  });
});
