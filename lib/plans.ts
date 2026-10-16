import type { Plan } from "@prisma/client";
import { PlanLimitError } from "./errors";
import { DEFAULT_PLAN_CONFIGS, getPlanConfig } from "./plan-config";

export type PlanLimits = {
  monitors: number;
  // En kısa izin verilen kontrol aralığı (saniye)
  minInterval: number;
  statusPages: number;
  customDomain: boolean;
  api: boolean;
};

const pick = (c: (typeof DEFAULT_PLAN_CONFIGS)[Plan]): PlanLimits => ({
  monitors: c.monitors,
  minInterval: c.minInterval,
  statusPages: c.statusPages,
  customDomain: c.customDomain,
  api: c.api,
});

// Kod içindeki varsayılan limitler. Gerçek değerler admin panelinden değiştirilebilir (bkz. getLimits).
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: pick(DEFAULT_PLAN_CONFIGS.FREE),
  PRO: pick(DEFAULT_PLAN_CONFIGS.PRO),
  BUSINESS: pick(DEFAULT_PLAN_CONFIGS.BUSINESS),
};

export function limitsFor(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

/** Admin panelinde ayarlanmış güncel limitler (veritabanı okunamazsa varsayılanlar). */
export async function getLimits(plan: Plan): Promise<PlanLimits> {
  try {
    return pick(await getPlanConfig(plan));
  } catch {
    return PLAN_LIMITS[plan];
  }
}

export function assertMonitorQuota(plan: Plan, currentCount: number, limits: PlanLimits = PLAN_LIMITS[plan]) {
  const limit = limits.monitors;
  if (currentCount >= limit) {
    throw new PlanLimitError(`Your ${plan} plan allows up to ${limit} monitors. Upgrade to add more.`, "monitors");
  }
}

export function assertIntervalAllowed(plan: Plan, interval: number, limits: PlanLimits = PLAN_LIMITS[plan]) {
  const min = limits.minInterval;
  if (interval < min) {
    throw new PlanLimitError(`Your ${plan} plan supports checks every ${min} seconds or slower.`, "interval");
  }
}

export function assertStatusPageQuota(plan: Plan, currentCount: number, limits: PlanLimits = PLAN_LIMITS[plan]) {
  const limit = limits.statusPages;
  if (currentCount >= limit) {
    throw new PlanLimitError(`Your ${plan} plan allows up to ${limit} status pages.`, "statusPages");
  }
}

export function assertCustomDomainAllowed(plan: Plan, limits: PlanLimits = PLAN_LIMITS[plan]) {
  if (!limits.customDomain) {
    throw new PlanLimitError("Custom domains are available on Pro and Business plans.", "customDomain");
  }
}

export function assertApiAllowed(plan: Plan, limits: PlanLimits = PLAN_LIMITS[plan]) {
  if (!limits.api) {
    throw new PlanLimitError("API access is available on Pro and Business plans.", "api");
  }
}
