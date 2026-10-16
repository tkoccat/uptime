import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const adapter = vi.hoisted(() => ({ setMonitorActive: vi.fn(async () => undefined) }));
vi.mock("@/lib/uptime-kuma", () => ({ getAdapter: () => adapter }));

const stripe = vi.hoisted(() => ({
  products: { create: vi.fn(async () => ({ id: "prod_test" })) },
  prices: { create: vi.fn() },
  subscriptions: { update: vi.fn(async () => ({})) },
}));
vi.mock("@/lib/stripe/client", () => ({ getStripe: () => stripe }));

const removed = vi.hoisted(() => ({ deleteAccount: vi.fn() }));
vi.mock("@/lib/account", () => removed);

import { applyOverrides } from "@/lib/admin/content-keys";
import { savePlanConfig } from "@/lib/admin/pricing";
import { deleteUserByAdmin, extendTrial, listUsers, setSuspended, setUserPlan, unlockUserPlan } from "@/lib/admin/users";
import { ValidationError } from "@/lib/errors";
import { getPlanConfigs, invalidatePlanConfigs } from "@/lib/plan-config";
import { prisma } from "@/lib/prisma";
import { getAnnouncement, getCompany, getContentOverrides, invalidateSiteConfig, signupsEnabled } from "@/lib/site-config";
import { applyPlan } from "@/lib/stripe/plan-change";
import { resolvePrice } from "@/lib/stripe/prices";
import { mkMonitor, mkUser } from "./helpers";

let priceN = 0;
beforeEach(() => {
  vi.clearAllMocks();
  invalidatePlanConfigs();
  invalidateSiteConfig();
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  stripe.prices.create.mockImplementation(async () => ({ id: `price_it_${++priceN}` }));
  removed.deleteAccount.mockImplementation(async (id: string) => {
    await prisma.user.delete({ where: { id } });
  });
});

afterAll(async () => {
  await prisma.planConfig.deleteMany();
  await prisma.siteSetting.deleteMany();
  await prisma.siteContent.deleteMany();
  invalidatePlanConfigs();
  invalidateSiteConfig();
});

const proInput = (over = {}) => ({
  priceMonthly: 1200, priceYearly: 11500, eurMonthly: 1400, eurYearly: null, usdMonthly: null, usdYearly: null,
  monitors: 60, minInterval: 60, statusPages: 5, customDomain: true, api: true, trialDays: 7, highlight: true, isActive: true,
  ...over,
});

describe("plan ve fiyat ayarları (gerçek veritabanı)", () => {
  it("kaydedilen plan okunur; Stripe ürün/fiyat kimlikleri saklanır", async () => {
    const res = await savePlanConfig("PRO", proInput());
    expect(res.warnings).toEqual([]);
    invalidatePlanConfigs();
    const c = (await getPlanConfigs()).PRO;
    expect(c).toMatchObject({ priceMonthly: 1200, priceYearly: 11500, eurMonthly: 1400, monitors: 60, trialDays: 7, stripeProductId: "prod_test" });
    expect(c.stripePriceMonthly).toMatch(/^price_it_/);
    expect(c.stripePriceYearly).toMatch(/^price_it_/);
    // diğer planlar varsayılan kalır
    expect((await getPlanConfigs()).BUSINESS.priceMonthly).toBe(2900);
  });

  it("fiyat değişince eski fiyat geçmişe taşınır ve hâlâ plana eşlenir", async () => {
    await savePlanConfig("PRO", proInput());
    invalidatePlanConfigs();
    const before = (await getPlanConfigs()).PRO;
    await savePlanConfig("PRO", proInput({ priceMonthly: 1500 }));
    invalidatePlanConfigs();
    const after = (await getPlanConfigs()).PRO;
    expect(after.stripePriceMonthly).not.toBe(before.stripePriceMonthly);
    expect(after.stripePriceYearly).toBe(before.stripePriceYearly); // yıllık değişmedi
    expect(after.stripePriceHistory).toContain(before.stripePriceMonthly);
    expect(await resolvePrice(before.stripePriceMonthly!)).toMatchObject({ plan: "PRO" });
    expect(await resolvePrice(after.stripePriceMonthly!)).toEqual({ plan: "PRO", billing: "monthly" });
  });

  it("geçersiz değerler kaydedilmez", async () => {
    await expect(savePlanConfig("PRO", proInput({ priceMonthly: 0 }))).rejects.toBeInstanceOf(ValidationError);
    await expect(savePlanConfig("PRO", proInput({ monitors: -1 }))).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("site ayarları ve içerik (gerçek veritabanı)", () => {
  it("duyuru, kayıt durumu ve şirket bilgileri okunur; boş değerler varsayılanı bozmaz", async () => {
    expect(await signupsEnabled()).toBe(true);
    expect((await getAnnouncement()).enabled).toBe(false);

    await prisma.siteSetting.upsert({ where: { key: "signups" }, create: { key: "signups", value: { enabled: false } }, update: { value: { enabled: false } } });
    await prisma.siteSetting.upsert({
      where: { key: "announcement" },
      create: { key: "announcement", value: { enabled: true, tone: "sale", text: { en: "20% off" }, link: "/pricing" } },
      update: { value: { enabled: true, tone: "sale", text: { en: "20% off" }, link: "/pricing" } },
    });
    await prisma.siteSetting.upsert({
      where: { key: "company" },
      create: { key: "company", value: { legalName: "Acme Ltd", address: "   " } },
      update: { value: { legalName: "Acme Ltd", address: "   " } },
    });
    invalidateSiteConfig();

    expect(await signupsEnabled()).toBe(false);
    expect(await getAnnouncement()).toMatchObject({ enabled: true, tone: "sale", link: "/pricing" });
    const company = await getCompany();
    expect(company.legalName).toBe("Acme Ltd");
    expect(company.address).toMatch(/REGISTERED ADDRESS/); // boş değer varsayılanı ezmez
  });

  it("içerik düzenlemeleri dile göre saklanır ve çeviri dosyasının üzerine uygulanır", async () => {
    await prisma.siteContent.createMany({
      data: [
        { key: "Home.heroTitle", locale: "en", value: "Custom headline" },
        { key: "Home.heroTitle", locale: "tr", value: "Özel başlık" },
        { key: "Faq.items", locale: "en", value: [{ q: "Q1?", a: "A1" }] },
        { key: "Auth.errors.unknown", locale: "en", value: "not allowed key" },
      ],
    });
    invalidateSiteConfig();

    const en = await getContentOverrides("en");
    const tr = await getContentOverrides("tr");
    expect(en["Home.heroTitle"]).toBe("Custom headline");
    expect(tr["Home.heroTitle"]).toBe("Özel başlık");
    expect(await getContentOverrides("de")).toEqual({});

    const messages = { Home: { heroTitle: "Default", heroSub: "Sub" }, Faq: { items: [] as unknown[] }, Auth: { errors: { unknown: "orig" } } };
    const merged = applyOverrides(messages, en);
    expect(merged.Home).toEqual({ heroTitle: "Custom headline", heroSub: "Sub" });
    expect(merged.Faq.items).toEqual([{ q: "Q1?", a: "A1" }]);
    expect(merged.Auth.errors.unknown).toBe("orig"); // izin listesinde olmayan anahtar uygulanmaz
  });
});

describe("kullanıcı yönetimi (gerçek veritabanı)", () => {
  it("arama e-postayı büyük/küçük harf duyarsız bulur, plana göre filtreler, sayfalar", async () => {
    const tag = `srch${Date.now()}`;
    for (let i = 0; i < 3; i++) await mkUser(i === 0 ? "PRO" : "FREE", { email: `${tag}-${i}@Find.Me` });
    const all = await listUsers({ q: tag.toUpperCase() });
    expect(all.total).toBe(3);
    expect((await listUsers({ q: tag, plan: "PRO" })).total).toBe(1);
    expect((await listUsers({ q: "no-such-user-xyz" })).users).toHaveLength(0);
  });

  it("plan elle verilir, kilitlenir; Stripe kaynaklı plan değişikliği kilitli kullanıcıya uygulanmaz; kilit açılınca senkron", async () => {
    const u = await mkUser("FREE");
    await setUserPlan(u.id, "BUSINESS", true);
    let row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row).toMatchObject({ plan: "BUSINESS", planLocked: true });

    const skipped = await applyPlan(u.id, "FREE"); // Stripe yolu
    expect(skipped).toMatchObject({ skipped: true });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).plan).toBe("BUSINESS");

    await unlockUserPlan(u.id); // abonelik yok -> Free
    row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row).toMatchObject({ plan: "FREE", planLocked: false });
  });

  it("Free'ye indirilen kullanıcının fazla monitörleri duraklatılır", async () => {
    const u = await mkUser("BUSINESS");
    for (let i = 0; i < 7; i++) await mkMonitor(u.id);
    await setUserPlan(u.id, "FREE", false);
    expect(await prisma.monitor.count({ where: { userId: u.id, isActive: true } })).toBe(5);
    expect(adapter.setMonitorActive).toHaveBeenCalledTimes(2);
  });

  it("askıya alma monitörleri durdurur; kaldırınca yeniden açar; yönetici askıya alınamaz", async () => {
    const u = await mkUser("PRO");
    await mkMonitor(u.id);
    await mkMonitor(u.id);
    await setSuspended(u.id, true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).suspendedAt).not.toBeNull();
    expect(await prisma.monitor.count({ where: { userId: u.id, isActive: true } })).toBe(0);

    await setSuspended(u.id, false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).suspendedAt).toBeNull();
    expect(await prisma.monitor.count({ where: { userId: u.id, isActive: true } })).toBe(2);

    const boss = await mkUser("PRO", { email: "boss@test.dev" });
    await expect(setSuspended(boss.id, true)).rejects.toBeInstanceOf(ValidationError);
  });

  it("deneme süresi uzatılır: veritabanı ve Stripe güncellenir", async () => {
    const u = await mkUser("PRO");
    const end = new Date(Date.now() + 2 * 86_400_000);
    await prisma.subscription.create({
      data: { userId: u.id, plan: "PRO", status: "TRIALING", currentPeriodEnd: end, stripeSubscriptionId: `sub_trial_${u.id}`, stripePriceId: "price_pro_m", trialEnd: end, trialReminderSentAt: new Date() },
    });
    const next = await extendTrial(u.id, 7);
    const sub = await prisma.subscription.findFirstOrThrow({ where: { userId: u.id } });
    expect(sub.trialEnd).toEqual(next);
    expect(sub.trialReminderSentAt).toBeNull(); // hatırlatma yeniden gönderilebilsin
    expect(stripe.subscriptions.update).toHaveBeenCalledWith(`sub_trial_${u.id}`, expect.objectContaining({ proration_behavior: "none" }));
  });

  it("silme: doğru e-posta onayı gerekir; kullanıcı ve verisi kalkar", async () => {
    const u = await mkUser("PRO");
    await mkMonitor(u.id);
    await expect(deleteUserByAdmin(u.id, "wrong@x.com")).rejects.toBeInstanceOf(ValidationError);
    expect(await prisma.user.count({ where: { id: u.id } })).toBe(1);
    expect(await deleteUserByAdmin(u.id, u.email.toUpperCase())).toBe(u.email);
    expect(await prisma.user.count({ where: { id: u.id } })).toBe(0);
    expect(await prisma.monitor.count({ where: { userId: u.id } })).toBe(0);
  });
});

describe("Stripe anahtarları (admin paneli)", () => {
  it("anahtarlar şifreli saklanır, ortam değişkeninin önüne geçer, silinince env'e dönülür", async () => {
    const { clearStripeKeys, getStripeKeys, invalidateStripeKeys, saveStripeKeys, validateStripeKeyShapes } = await import("@/lib/stripe/config");
    process.env.STRIPE_SECRET_KEY = "sk_test_fromenv";
    invalidateStripeKeys();
    expect((await getStripeKeys()).source).toBe("env");

    await saveStripeKeys({ secretKey: "sk_test_fromadmin1234", webhookSecret: "whsec_abc123" });
    const keys = await getStripeKeys();
    expect(keys).toMatchObject({ secretKey: "sk_test_fromadmin1234", webhookSecret: "whsec_abc123", source: "admin" });
    const raw = JSON.stringify((await prisma.siteSetting.findUniqueOrThrow({ where: { key: "stripe" } })).value);
    expect(raw).not.toContain("fromadmin"); // veritabanında düz metin yok

    await saveStripeKeys({ publishableKey: "pk_test_abc" }); // boş alanlar mevcut değeri korur
    expect(await getStripeKeys()).toMatchObject({ secretKey: "sk_test_fromadmin1234", publishableKey: "pk_test_abc" });

    await clearStripeKeys();
    expect((await getStripeKeys()).secretKey).toBe("sk_test_fromenv");
    expect(validateStripeKeyShapes({ secretKey: "pk_test_x" })).toMatch(/Secret key/);
    expect(validateStripeKeyShapes({ webhookSecret: "whsec_ok1" })).toBeNull();
  });
});