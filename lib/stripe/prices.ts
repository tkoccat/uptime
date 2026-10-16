import type { Plan } from "@prisma/client";
import { getPlanConfigs } from "../plan-config";

export type PaidPlan = Exclude<Plan, "FREE">;
export type Billing = "monthly" | "yearly";

const ENV_KEYS: Record<PaidPlan, Record<Billing, string>> = {
  PRO: { monthly: "STRIPE_PRICE_ID_PRO_MONTHLY", yearly: "STRIPE_PRICE_ID_PRO_YEARLY" },
  BUSINESS: { monthly: "STRIPE_PRICE_ID_BUSINESS_MONTHLY", yearly: "STRIPE_PRICE_ID_BUSINESS_YEARLY" },
};

const PAID: PaidPlan[] = ["PRO", "BUSINESS"];
const BILLINGS: Billing[] = ["monthly", "yearly"];

/**
 * Fiyat kimliği önceliği: admin panelinde tanımlanan (veritabanı), yoksa ortam değişkeni.
 * Böylece admin fiyatı değiştirince yeni Stripe fiyatı hemen kullanılır.
 */
export async function priceIdFor(plan: PaidPlan, billing: Billing): Promise<string> {
  const cfg = (await getPlanConfigs())[plan];
  const fromDb = billing === "monthly" ? cfg.stripePriceMonthly : cfg.stripePriceYearly;
  const id = fromDb ?? process.env[ENV_KEYS[plan][billing]];
  if (!id) throw new Error(`${plan} ${billing} için Stripe fiyatı tanımlı değil (admin panelinden fiyat kaydedin)`);
  return id;
}

/** Stripe fiyat kimliğinden plan ve dönem çıkarır; eski (değiştirilmiş) fiyatlar da tanınır. Bilinmeyen için null. */
export async function resolvePrice(priceId: string): Promise<{ plan: PaidPlan; billing: Billing | null } | null> {
  const configs = await getPlanConfigs();
  for (const plan of PAID) {
    const c = configs[plan];
    if (c.stripePriceMonthly === priceId) return { plan, billing: "monthly" };
    if (c.stripePriceYearly === priceId) return { plan, billing: "yearly" };
    if (c.stripePriceHistory.includes(priceId)) return { plan, billing: null };
    for (const billing of BILLINGS) {
      if (process.env[ENV_KEYS[plan][billing]] === priceId) return { plan, billing };
    }
  }
  return null;
}

/** Stripe fiyat kimliğinden plan çıkarır; bilinmeyen fiyat için null (tahmin edilmez). */
export async function planFromPriceId(priceId: string): Promise<PaidPlan | null> {
  return (await resolvePrice(priceId))?.plan ?? null;
}

/** Fiyat kimliğinin aylık mı yıllık mı olduğunu döndürür (bilinmiyorsa null). */
export async function billingFromPriceId(priceId: string): Promise<Billing | null> {
  return (await resolvePrice(priceId))?.billing ?? null;
}

// Desteklenen para birimleri (fiyatlarda currency_options tanımlı olmalı)
export const CURRENCIES = ["gbp", "eur", "usd"] as const;
export type Currency = (typeof CURRENCIES)[number];
export function isCurrency(v: string): v is Currency {
  return (CURRENCIES as readonly string[]).includes(v);
}
