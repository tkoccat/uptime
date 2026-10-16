import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ planConfig: { findMany: vi.fn() } }));
vi.mock("../prisma", () => ({ prisma: db }));

const stripe = vi.hoisted(() => ({
  coupons: { create: vi.fn() },
  promotionCodes: { create: vi.fn(), update: vi.fn(), list: vi.fn() },
}));
vi.mock("../stripe/client", () => ({ getStripe: () => stripe }));

import { ValidationError } from "../errors";
import { DEFAULT_PLAN_CONFIGS, invalidatePlanConfigs } from "../plan-config";
import { createDiscount, deactivateDiscount, listDiscounts } from "./coupons";

const base = { code: "LAUNCH20", kind: "percent" as const, percentOff: 20, duration: "once" as const };

beforeEach(() => {
  vi.clearAllMocks();
  invalidatePlanConfigs();
  db.planConfig.findMany.mockResolvedValue([
    { ...DEFAULT_PLAN_CONFIGS.PRO, stripeProductId: "prod_pro" },
    { ...DEFAULT_PLAN_CONFIGS.BUSINESS, stripeProductId: "prod_biz" },
  ]);
  stripe.coupons.create.mockResolvedValue({ id: "coupon_1" });
  stripe.promotionCodes.create.mockResolvedValue({ id: "promo_1", code: "LAUNCH20" });
});

describe("indirim kodu oluşturma", () => {
  it("yüzde indirimli kupon ve büyük harfli promosyon kodu oluşturur", async () => {
    const res = await createDiscount(base);
    expect(stripe.coupons.create).toHaveBeenCalledWith(expect.objectContaining({ percent_off: 20, duration: "once", name: "LAUNCH20" }));
    expect(stripe.promotionCodes.create).toHaveBeenCalledWith(
      expect.objectContaining({ promotion: { type: "coupon", coupon: "coupon_1" }, code: "LAUNCH20" })
    );
    expect(res).toMatchObject({ promoId: "promo_1", couponId: "coupon_1" });
  });

  it("sabit tutarlı indirim GBP ile gönderilir", async () => {
    await createDiscount({ code: "FIVEOFF", kind: "amount", amountOff: 500, duration: "once" });
    expect(stripe.coupons.create).toHaveBeenCalledWith(expect.objectContaining({ amount_off: 500, currency: "gbp" }));
  });

  it("tekrarlayan indirim ay sayısı ister", async () => {
    await expect(createDiscount({ ...base, duration: "repeating" })).rejects.toBeInstanceOf(ValidationError);
    await createDiscount({ ...base, duration: "repeating", months: 3 });
    expect(stripe.coupons.create).toHaveBeenCalledWith(expect.objectContaining({ duration: "repeating", duration_in_months: 3 }));
  });

  it("kullanım sınırı, son tarih ve yeni müşteri kısıtı iletilir", async () => {
    const expiresAt = new Date("2027-01-31T23:59:59Z");
    await createDiscount({ ...base, maxRedemptions: 100, expiresAt, firstTimeOnly: true });
    expect(stripe.promotionCodes.create).toHaveBeenCalledWith(
      expect.objectContaining({ max_redemptions: 100, expires_at: Math.floor(expiresAt.getTime() / 1000), restrictions: { first_time_transaction: true } })
    );
  });

  it("seçilen planlara kısıtlar (yalnızca o ürünler)", async () => {
    await createDiscount({ ...base, plans: ["PRO"] });
    expect(stripe.coupons.create).toHaveBeenCalledWith(expect.objectContaining({ applies_to: { products: ["prod_pro"] } }));
  });

  it("Stripe ürünü olmayan plana kısıtlama reddedilir", async () => {
    invalidatePlanConfigs();
    db.planConfig.findMany.mockResolvedValue([]);
    await expect(createDiscount({ ...base, plans: ["PRO"] })).rejects.toBeInstanceOf(ValidationError);
    expect(stripe.coupons.create).not.toHaveBeenCalled();
  });

  it("geçersiz kod, yüzde ve değer reddedilir; Stripe'a gidilmez", async () => {
    for (const bad of [
      { ...base, code: "a b" },
      { ...base, code: "ab" },
      { ...base, percentOff: 0 },
      { ...base, percentOff: 101 },
      { ...base, percentOff: undefined },
      { code: "X-1", kind: "amount" as const, duration: "once" as const },
    ]) {
      await expect(createDiscount(bad)).rejects.toBeInstanceOf(ValidationError);
    }
    expect(stripe.coupons.create).not.toHaveBeenCalled();
  });
});

describe("indirim kodunu kapatma ve listeleme", () => {
  it("yalnızca promosyon kodu kimliği biçimi kabul edilir", async () => {
    await expect(deactivateDiscount("coupon_1")).rejects.toBeInstanceOf(ValidationError);
    await expect(deactivateDiscount("promo_1; DROP")).rejects.toBeInstanceOf(ValidationError);
    await deactivateDiscount("promo_abc123");
    expect(stripe.promotionCodes.update).toHaveBeenCalledWith("promo_abc123", { active: false });
  });

  it("liste yüzde ve tutar indirimlerini okunur metne çevirir", async () => {
    stripe.promotionCodes.list.mockResolvedValue({
      data: [
        { id: "promo_1", code: "A", active: true, times_redeemed: 3, max_redemptions: 10, expires_at: null, promotion: { coupon: { percent_off: 20, duration: "once" } } },
        { id: "promo_2", code: "B", active: false, times_redeemed: 0, max_redemptions: null, expires_at: 1_800_000_000, promotion: { coupon: { amount_off: 500, currency: "gbp", duration: "repeating", duration_in_months: 3 } } },
      ],
    });
    const rows = await listDiscounts();
    expect(rows[0]).toMatchObject({ code: "A", description: "20% off", duration: "once", redeemed: 3, maxRedemptions: 10 });
    expect(rows[1]).toMatchObject({ description: "5.00 GBP off", duration: "3 months", active: false });
    expect(rows[1].expiresAt).toEqual(new Date(1_800_000_000 * 1000));
  });
});
