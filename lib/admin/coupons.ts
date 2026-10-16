import type Stripe from "stripe";
import { z } from "zod";
import { ValidationError } from "../errors";
import { getPlanConfigs } from "../plan-config";
import { prisma } from "../prisma";
import { getSetting, invalidateSiteConfig } from "../site-config";
import { getStripe } from "../stripe/client";

// İndirim kodları Stripe kupon + promosyon kodu olarak yönetilir. Checkout `allow_promotion_codes` ile kodları kabul eder.

export const couponInputSchema = z
  .object({
    code: z.string().trim().regex(/^[A-Za-z0-9-]{3,32}$/, "3-32 characters: letters, digits, dashes"),
    kind: z.enum(["percent", "amount"]),
    percentOff: z.number().min(1).max(100).optional(),
    // Küçük birim (GBP peni)
    amountOff: z.number().int().min(1).optional(),
    duration: z.enum(["once", "repeating", "forever"]),
    months: z.number().int().min(1).max(36).optional(),
    maxRedemptions: z.number().int().min(1).max(1_000_000).optional(),
    expiresAt: z.date().optional(),
    // Boşsa tüm planlar; doluysa yalnızca bu planların ürünleri
    plans: z.array(z.enum(["PRO", "BUSINESS"])).default([]),
    firstTimeOnly: z.boolean().default(false),
  })
  .refine((v) => (v.kind === "percent" ? v.percentOff !== undefined : v.amountOff !== undefined), { message: "Discount value is required" })
  .refine((v) => v.duration !== "repeating" || v.months !== undefined, { message: "Months are required for repeating discounts" });

export type CouponInput = z.input<typeof couponInputSchema>;

export type DiscountRow = {
  id: string;
  code: string;
  active: boolean;
  description: string;
  duration: string;
  redeemed: number;
  maxRedemptions: number | null;
  expiresAt: Date | null;
};

function describe(c: Stripe.Coupon | null): { text: string; duration: string } {
  if (!c) return { text: "—", duration: "—" };
  const value = c.percent_off != null ? `${c.percent_off}% off` : `${((c.amount_off ?? 0) / 100).toFixed(2)} ${(c.currency ?? "").toUpperCase()} off`;
  const duration = c.duration === "repeating" ? `${c.duration_in_months} months` : c.duration;
  return { text: value, duration };
}

export async function listDiscounts(): Promise<DiscountRow[]> {
  const res = await (await getStripe()).promotionCodes.list({ limit: 100, expand: ["data.promotion.coupon"] });
  return res.data.map((p) => {
    const coupon = typeof p.promotion.coupon === "object" ? p.promotion.coupon : null;
    const d = describe(coupon);
    return {
      id: p.id,
      code: p.code,
      active: p.active,
      description: d.text,
      duration: d.duration,
      redeemed: p.times_redeemed,
      maxRedemptions: p.max_redemptions,
      expiresAt: p.expires_at ? new Date(p.expires_at * 1000) : null,
    };
  });
}

export async function createDiscount(raw: unknown) {
  const parsed = couponInputSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid discount");
  const v = parsed.data;
  const stripe = await getStripe();

  let applies: { products: string[] } | undefined;
  if (v.plans.length > 0) {
    const configs = await getPlanConfigs();
    const products = v.plans.map((p) => configs[p].stripeProductId).filter((x): x is string => Boolean(x));
    if (products.length !== v.plans.length) throw new ValidationError("Save the selected plan's price first so it has a Stripe product");
    applies = { products };
  }

  const coupon = await stripe.coupons.create({
    name: v.code,
    ...(v.kind === "percent" ? { percent_off: v.percentOff } : { amount_off: v.amountOff, currency: "gbp" }),
    duration: v.duration,
    ...(v.duration === "repeating" ? { duration_in_months: v.months } : {}),
    ...(applies ? { applies_to: applies } : {}),
  });

  const promo = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    code: v.code.toUpperCase(),
    ...(v.maxRedemptions ? { max_redemptions: v.maxRedemptions } : {}),
    ...(v.expiresAt ? { expires_at: Math.floor(v.expiresAt.getTime() / 1000) } : {}),
    ...(v.firstTimeOnly ? { restrictions: { first_time_transaction: true } } : {}),
  });
  return { couponId: coupon.id, promoId: promo.id, code: promo.code };
}

export async function setDiscountActive(promoId: string, active: boolean) {
  if (!/^promo_[A-Za-z0-9]+$/.test(promoId)) throw new ValidationError("Invalid promotion code id");
  await (await getStripe()).promotionCodes.update(promoId, { active });
}

export const deactivateDiscount = (promoId: string) => setDiscountActive(promoId, false);

// Otomatik indirim: tüm ödemelere kod girilmeden uygulanan bir kupon (ör. lansman kampanyası).
// Stripe, `discounts` ile `allow_promotion_codes` değerini birlikte kabul etmez; otomatik indirim varken kod alanı gizlenir.
export type AutoDiscount = { couponId: string; label: string } | null;

export async function getAutoDiscount(): Promise<AutoDiscount> {
  const v = await getSetting<{ couponId?: string; label?: string } | null>("autoDiscount", null);
  return v?.couponId ? { couponId: v.couponId, label: v.label ?? "" } : null;
}

export async function setAutoDiscount(promoId: string | null) {
  if (promoId === null) {
    await prisma.siteSetting.deleteMany({ where: { key: "autoDiscount" } });
    invalidateSiteConfig();
    return;
  }
  if (!/^promo_[A-Za-z0-9]+$/.test(promoId)) throw new ValidationError("Invalid promotion code id");
  const promo = await (await getStripe()).promotionCodes.retrieve(promoId, { expand: ["promotion.coupon"] });
  const coupon = typeof promo.promotion.coupon === "object" ? promo.promotion.coupon : null;
  if (!coupon) throw new ValidationError("Coupon not found");
  const value = { couponId: coupon.id, label: `${promo.code} (${describe(coupon).text})` };
  await prisma.siteSetting.upsert({ where: { key: "autoDiscount" }, create: { key: "autoDiscount", value }, update: { value } });
  invalidateSiteConfig();
}
