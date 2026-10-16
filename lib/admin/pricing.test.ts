import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  planConfig: { findMany: vi.fn(), upsert: vi.fn() },
  siteSetting: { findMany: vi.fn() },
}));
vi.mock("../prisma", () => ({ prisma: db }));

const stripe = vi.hoisted(() => ({
  products: { create: vi.fn() },
  prices: { create: vi.fn() },
}));
vi.mock("../stripe/client", () => ({ getStripe: () => stripe }));

import { ValidationError } from "../errors";
import { invalidatePlanConfigs } from "../plan-config";
import { needsNewPrice, parseMoney, savePlanConfig, type PlanInput } from "./pricing";
import { DEFAULT_PLAN_CONFIGS } from "../plan-config";

const input = (over: Partial<PlanInput> = {}): PlanInput => ({
  priceMonthly: 900,
  priceYearly: 8600,
  eurMonthly: null,
  eurYearly: null,
  usdMonthly: null,
  usdYearly: null,
  monitors: 50,
  minInterval: 60,
  statusPages: 5,
  customDomain: true,
  api: true,
  trialDays: 14,
  highlight: true,
  isActive: true,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  invalidatePlanConfigs();
  db.planConfig.findMany.mockResolvedValue([]);
  db.siteSetting.findMany.mockResolvedValue([]);
  db.planConfig.upsert.mockResolvedValue({});
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  stripe.products.create.mockResolvedValue({ id: "prod_1" });
  let n = 0;
  stripe.prices.create.mockImplementation(async () => ({ id: `price_new_${++n}` }));
});

describe("parseMoney", () => {
  it("ana birimi küçük birime çevirir; virgül ve boş değer desteklenir", () => {
    expect(parseMoney("9")).toBe(900);
    expect(parseMoney("9.5")).toBe(950);
    expect(parseMoney("9,99")).toBe(999);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("0.07")).toBe(7);
  });
  it("geçersiz tutarı reddeder", () => {
    for (const bad of ["abc", "-1", "1.234", "1e3", "£5"]) expect(() => parseMoney(bad)).toThrow(ValidationError);
  });
});

describe("needsNewPrice", () => {
  const cur = { ...DEFAULT_PLAN_CONFIGS.PRO, stripePriceMonthly: "price_m", stripePriceYearly: "price_y" };
  it("fiyat değişmediyse yeni Stripe fiyatı gerekmez", () => {
    expect(needsNewPrice(cur, input(), "monthly")).toBe(false);
    expect(needsNewPrice(cur, input(), "yearly")).toBe(false);
  });
  it("tutar veya para birimi seçeneği değişince gerekir", () => {
    expect(needsNewPrice(cur, input({ priceMonthly: 1000 }), "monthly")).toBe(true);
    expect(needsNewPrice(cur, input({ eurYearly: 9000 }), "yearly")).toBe(true);
    expect(needsNewPrice(cur, input({ priceMonthly: 1000 }), "yearly")).toBe(false);
  });
  it("Stripe fiyatı hiç yoksa gerekir", () => {
    expect(needsNewPrice(DEFAULT_PLAN_CONFIGS.PRO, input(), "monthly")).toBe(true);
  });
});

describe("savePlanConfig", () => {
  it("ilk kayıtta ürün ve iki fiyat oluşturur, kimlikleri saklar", async () => {
    const res = await savePlanConfig("PRO", input());
    expect(stripe.products.create).toHaveBeenCalledTimes(1);
    expect(stripe.prices.create).toHaveBeenCalledTimes(2);
    const calls = stripe.prices.create.mock.calls.map((c) => c[0]);
    expect(calls[0]).toMatchObject({ product: "prod_1", currency: "gbp", unit_amount: 900, recurring: { interval: "month" }, tax_behavior: "exclusive" });
    expect(calls[1]).toMatchObject({ unit_amount: 8600, recurring: { interval: "year" } });
    const saved = db.planConfig.upsert.mock.calls[0][0].update;
    expect(saved).toMatchObject({ stripeProductId: "prod_1", stripePriceMonthly: "price_new_1", stripePriceYearly: "price_new_2", stripePriceHistory: [] });
    expect(res.warnings).toEqual([]);
  });

  it("EUR/USD seçenekleri currency_options olarak gönderilir", async () => {
    await savePlanConfig("PRO", input({ eurMonthly: 1000, usdMonthly: 1100 }));
    const monthly = stripe.prices.create.mock.calls[0][0];
    expect(monthly.currency_options).toEqual({
      eur: { unit_amount: 1000, tax_behavior: "exclusive" },
      usd: { unit_amount: 1100, tax_behavior: "exclusive" },
    });
  });

  it("yalnızca limit değişince yeni Stripe fiyatı oluşturulmaz", async () => {
    db.planConfig.findMany.mockResolvedValue([
      { ...DEFAULT_PLAN_CONFIGS.PRO, stripeProductId: "prod_1", stripePriceMonthly: "price_m", stripePriceYearly: "price_y", stripePriceHistory: [] },
    ]);
    await savePlanConfig("PRO", input({ monitors: 80 }));
    expect(stripe.prices.create).not.toHaveBeenCalled();
    expect(db.planConfig.upsert.mock.calls[0][0].update).toMatchObject({ monitors: 80, stripePriceMonthly: "price_m", stripePriceYearly: "price_y" });
  });

  it("fiyat değişince yeni fiyat açılır, eskisi geçmişe taşınır (mevcut aboneler tanınsın)", async () => {
    db.planConfig.findMany.mockResolvedValue([
      { ...DEFAULT_PLAN_CONFIGS.PRO, stripeProductId: "prod_1", stripePriceMonthly: "price_m", stripePriceYearly: "price_y", stripePriceHistory: ["price_old"] },
    ]);
    await savePlanConfig("PRO", input({ priceMonthly: 1200 }));
    expect(stripe.prices.create).toHaveBeenCalledTimes(1);
    const saved = db.planConfig.upsert.mock.calls[0][0].update;
    expect(saved.stripePriceMonthly).toBe("price_new_1");
    expect(saved.stripePriceYearly).toBe("price_y");
    expect(saved.stripePriceHistory.sort()).toEqual(["price_m", "price_old"]);
  });

  it("Stripe yapılandırılmamışsa kaydeder ve uyarı döner", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const res = await savePlanConfig("PRO", input());
    expect(stripe.prices.create).not.toHaveBeenCalled();
    expect(res.warnings[0]).toMatch(/Stripe is not configured/);
    expect(db.planConfig.upsert).toHaveBeenCalled();
  });

  it("ücretli planda sıfır fiyat reddedilir", async () => {
    await expect(savePlanConfig("PRO", input({ priceMonthly: 0 }))).rejects.toBeInstanceOf(ValidationError);
    expect(db.planConfig.upsert).not.toHaveBeenCalled();
  });

  it("Free planın fiyatı her zaman 0'a sabitlenir ve Stripe'a dokunulmaz", async () => {
    await savePlanConfig("FREE", input({ priceMonthly: 500, eurMonthly: 400 }));
    expect(stripe.prices.create).not.toHaveBeenCalled();
    expect(db.planConfig.upsert.mock.calls[0][0].update).toMatchObject({ priceMonthly: 0, priceYearly: 0, eurMonthly: null });
  });

  it("geçersiz limitler reddedilir", async () => {
    await expect(savePlanConfig("PRO", input({ monitors: 0 }))).rejects.toBeInstanceOf(ValidationError);
    await expect(savePlanConfig("PRO", input({ minInterval: 5 }))).rejects.toBeInstanceOf(ValidationError);
    await expect(savePlanConfig("PRO", { nonsense: true })).rejects.toBeInstanceOf(ValidationError);
  });
});
