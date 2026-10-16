import type { Plan } from "@prisma/client";

export type PaidPlan = Exclude<Plan, "FREE">;
export type Billing = "monthly" | "yearly";

const ENV_KEYS: Record<PaidPlan, Record<Billing, string>> = {
  PRO: { monthly: "STRIPE_PRICE_ID_PRO_MONTHLY", yearly: "STRIPE_PRICE_ID_PRO_YEARLY" },
  BUSINESS: { monthly: "STRIPE_PRICE_ID_BUSINESS_MONTHLY", yearly: "STRIPE_PRICE_ID_BUSINESS_YEARLY" },
};

export function priceIdFor(plan: PaidPlan, billing: Billing): string {
  const id = process.env[ENV_KEYS[plan][billing]];
  if (!id) throw new Error(`${ENV_KEYS[plan][billing]} tanımlı değil`);
  return id;
}

/** Stripe fiyat kimliğinden plan çıkarır; bilinmeyen fiyat için null (tahmin edilmez). */
export function planFromPriceId(priceId: string): PaidPlan | null {
  for (const plan of Object.keys(ENV_KEYS) as PaidPlan[]) {
    for (const billing of Object.keys(ENV_KEYS[plan]) as Billing[]) {
      if (process.env[ENV_KEYS[plan][billing]] === priceId) return plan;
    }
  }
  return null;
}

// Desteklenen para birimleri (fiyatlarda currency_options tanımlı olmalı)
export const CURRENCIES = ["gbp", "eur", "usd"] as const;
export type Currency = (typeof CURRENCIES)[number];
export function isCurrency(v: string): v is Currency {
  return (CURRENCIES as readonly string[]).includes(v);
}
