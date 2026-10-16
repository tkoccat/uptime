import type { Plan, PlanConfig as PlanConfigRow } from "@prisma/client";
import { ttlCache } from "./cache";
import { prisma } from "./prisma";

// Plan ayarları: varsayılanlar kodda, admin panelinde yapılan değişiklikler veritabanında tutulur.
// Tutarlar küçük birimdedir (GBP için peni).

export type PlanConfigData = {
  plan: Plan;
  priceMonthly: number;
  priceYearly: number;
  eurMonthly: number | null;
  eurYearly: number | null;
  usdMonthly: number | null;
  usdYearly: number | null;
  monitors: number;
  minInterval: number;
  statusPages: number;
  customDomain: boolean;
  api: boolean;
  trialDays: number;
  highlight: boolean;
  isActive: boolean;
  stripeProductId: string | null;
  stripePriceMonthly: string | null;
  stripePriceYearly: string | null;
  stripePriceHistory: string[];
};

const base = {
  eurMonthly: null,
  eurYearly: null,
  usdMonthly: null,
  usdYearly: null,
  isActive: true,
  stripeProductId: null,
  stripePriceMonthly: null,
  stripePriceYearly: null,
  stripePriceHistory: [] as string[],
};

export const DEFAULT_PLAN_CONFIGS: Record<Plan, PlanConfigData> = {
  FREE: { ...base, plan: "FREE", priceMonthly: 0, priceYearly: 0, monitors: 5, minInterval: 180, statusPages: 1, customDomain: false, api: false, trialDays: 0, highlight: false },
  PRO: { ...base, plan: "PRO", priceMonthly: 900, priceYearly: 8600, monitors: 50, minInterval: 60, statusPages: 5, customDomain: true, api: true, trialDays: 14, highlight: true },
  BUSINESS: { ...base, plan: "BUSINESS", priceMonthly: 2900, priceYearly: 27800, monitors: 200, minInterval: 30, statusPages: 20, customDomain: true, api: true, trialDays: 0, highlight: false },
};

export const PLAN_ORDER: Plan[] = ["FREE", "PRO", "BUSINESS"];

/** Veritabanı satırını varsayılanların üzerine uygular. */
export function mergeConfig(plan: Plan, row: PlanConfigRow | undefined): PlanConfigData {
  const d = DEFAULT_PLAN_CONFIGS[plan];
  if (!row) return d;
  return {
    plan,
    priceMonthly: row.priceMonthly,
    priceYearly: row.priceYearly,
    eurMonthly: row.eurMonthly,
    eurYearly: row.eurYearly,
    usdMonthly: row.usdMonthly,
    usdYearly: row.usdYearly,
    monitors: row.monitors,
    minInterval: row.minInterval,
    statusPages: row.statusPages,
    customDomain: row.customDomain,
    api: row.api,
    trialDays: row.trialDays,
    highlight: row.highlight,
    isActive: row.isActive,
    stripeProductId: row.stripeProductId,
    stripePriceMonthly: row.stripePriceMonthly,
    stripePriceYearly: row.stripePriceYearly,
    stripePriceHistory: row.stripePriceHistory,
  };
}

const cache = ttlCache(30_000, async (): Promise<Record<Plan, PlanConfigData>> => {
  let rows: PlanConfigRow[] = [];
  try {
    rows = await prisma.planConfig.findMany();
  } catch (err) {
    // Veritabanı yoksa (build sırası, kesinti) varsayılanlarla devam edilir
    console.warn("[plan-config] veritabanından okunamadı, varsayılanlar kullanılıyor:", (err as Error).message?.slice(0, 120));
  }
  const byPlan = new Map(rows.map((r) => [r.plan, r]));
  return {
    FREE: mergeConfig("FREE", byPlan.get("FREE")),
    PRO: mergeConfig("PRO", byPlan.get("PRO")),
    BUSINESS: mergeConfig("BUSINESS", byPlan.get("BUSINESS")),
  };
});

export function getPlanConfigs() {
  return cache.get();
}

export async function getPlanConfig(plan: Plan): Promise<PlanConfigData> {
  return (await cache.get())[plan];
}

export function invalidatePlanConfigs() {
  cache.invalidate();
}

/** Para birimi biçimi: küçük birimden (peni/sent) yerel biçime. */
export function formatMoney(minor: number, currency: string, locale: string): string {
  const major = minor / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: Number.isInteger(major) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
}

/** Yıllık fiyatın, 12 aylık ödemeye göre indirim yüzdesi (0-100). */
export function yearlyDiscountPct(monthly: number, yearly: number): number {
  if (monthly <= 0) return 0;
  return Math.max(0, Math.round((1 - yearly / (monthly * 12)) * 100));
}
