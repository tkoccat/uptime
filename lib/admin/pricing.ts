import type { Plan } from "@prisma/client";
import { z } from "zod";
import { ValidationError } from "../errors";
import { DEFAULT_PLAN_CONFIGS, getPlanConfig, invalidatePlanConfigs, type PlanConfigData } from "../plan-config";
import { prisma } from "../prisma";
import { getCompany } from "../site-config";
import { getStripe } from "../stripe/client";
import { isStripeConfigured } from "../stripe/config";

// Admin panelinde plan fiyatı ve limitlerinin kaydedilmesi.
// Stripe'ta bir fiyat sonradan değiştirilemez: fiyat değişince yeni bir Stripe fiyatı oluşturulur,
// eskisi geçmişte tutulur (mevcut aboneler eski fiyattan devam eder ve doğru plana eşlenmeye devam eder).

const minor = z.number().int().min(0).max(100_000_00);
const optMinor = minor.nullable();

export const planInputSchema = z.object({
  priceMonthly: minor,
  priceYearly: minor,
  eurMonthly: optMinor,
  eurYearly: optMinor,
  usdMonthly: optMinor,
  usdYearly: optMinor,
  monitors: z.number().int().min(1).max(100_000),
  minInterval: z.number().int().min(20).max(86_400),
  statusPages: z.number().int().min(0).max(1_000),
  customDomain: z.boolean(),
  api: z.boolean(),
  trialDays: z.number().int().min(0).max(365),
  highlight: z.boolean(),
  isActive: z.boolean(),
});

export type PlanInput = z.infer<typeof planInputSchema>;

/** "9.50" veya "9,50" biçimindeki ana birim girdisini küçük birime çevirir; boş = null. */
export function parseMoney(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!s) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new ValidationError(`Invalid amount: ${raw}`);
  return Math.round(Number(s) * 100);
}

type PriceCall = { interval: "month" | "year"; gbp: number; eur: number | null; usd: number | null };

/** Fiyat alanlarından herhangi biri değiştiyse (veya Stripe fiyatı hiç yoksa) yeni Stripe fiyatı gerekir. */
export function needsNewPrice(cur: PlanConfigData, next: PlanInput, period: "monthly" | "yearly"): boolean {
  if (period === "monthly") {
    return !cur.stripePriceMonthly || cur.priceMonthly !== next.priceMonthly || cur.eurMonthly !== next.eurMonthly || cur.usdMonthly !== next.usdMonthly;
  }
  return !cur.stripePriceYearly || cur.priceYearly !== next.priceYearly || cur.eurYearly !== next.eurYearly || cur.usdYearly !== next.usdYearly;
}

async function createStripePrice(productId: string, c: PriceCall): Promise<string> {
  const currencyOptions: Record<string, { unit_amount: number; tax_behavior: "exclusive" }> = {};
  if (c.eur !== null) currencyOptions.eur = { unit_amount: c.eur, tax_behavior: "exclusive" };
  if (c.usd !== null) currencyOptions.usd = { unit_amount: c.usd, tax_behavior: "exclusive" };

  const price = await (await getStripe()).prices.create({
    product: productId,
    currency: "gbp",
    unit_amount: c.gbp,
    recurring: { interval: c.interval },
    // KDV fiyatın üstüne eklenir (fiyat tablosundaki "VAT eklenir" notuyla tutarlı)
    tax_behavior: "exclusive",
    ...(Object.keys(currencyOptions).length ? { currency_options: currencyOptions } : {}),
  });
  return price.id;
}

export type SavePlanResult = { warnings: string[]; before: PlanConfigData; after: PlanConfigData };

export async function savePlanConfig(plan: Plan, raw: unknown): Promise<SavePlanResult> {
  const parsed = planInputSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Invalid plan values");
  const input = parsed.data;
  const warnings: string[] = [];

  if (plan === "FREE") {
    // Ücretsiz planın fiyatı değişmez
    input.priceMonthly = 0;
    input.priceYearly = 0;
    input.eurMonthly = input.eurYearly = input.usdMonthly = input.usdYearly = null;
  } else if (input.priceMonthly <= 0 || input.priceYearly <= 0) {
    throw new ValidationError("Paid plans need a monthly and a yearly price above zero");
  }

  const before = await getPlanConfig(plan);
  let { stripeProductId, stripePriceMonthly, stripePriceYearly } = before;
  const history = [...before.stripePriceHistory];

  if (plan !== "FREE") {
    const stripeReady = await isStripeConfigured();
    const mChanged = needsNewPrice(before, input, "monthly");
    const yChanged = needsNewPrice(before, input, "yearly");

    if (!stripeReady) {
      if (mChanged || yChanged) warnings.push("Stripe is not configured: prices were saved but no Stripe price was created, so checkout will not use them yet.");
    } else if (mChanged || yChanged) {
      const stripe = await getStripe();
      if (!stripeProductId) {
        const company = await getCompany();
        const product = await stripe.products.create({ name: `${company.productName} ${plan[0]}${plan.slice(1).toLowerCase()}`, metadata: { plan } });
        stripeProductId = product.id;
      }
      if (mChanged) {
        const id = await createStripePrice(stripeProductId, { interval: "month", gbp: input.priceMonthly, eur: input.eurMonthly, usd: input.usdMonthly });
        if (stripePriceMonthly) history.push(stripePriceMonthly);
        stripePriceMonthly = id;
      }
      if (yChanged) {
        const id = await createStripePrice(stripeProductId, { interval: "year", gbp: input.priceYearly, eur: input.eurYearly, usd: input.usdYearly });
        if (stripePriceYearly) history.push(stripePriceYearly);
        stripePriceYearly = id;
      }
    }
  }

  const data = {
    ...input,
    stripeProductId,
    stripePriceMonthly,
    stripePriceYearly,
    stripePriceHistory: [...new Set(history)],
  };
  await prisma.planConfig.upsert({ where: { plan }, create: { plan, ...data }, update: data });
  invalidatePlanConfigs();

  return { warnings, before, after: { ...DEFAULT_PLAN_CONFIGS[plan], ...data, plan } as PlanConfigData };
}
