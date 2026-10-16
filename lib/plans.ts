import type { Plan } from "@prisma/client";
import { PlanLimitError } from "./errors";

export type PlanLimits = {
  monitors: number;
  // En kısa izin verilen kontrol aralığı (saniye)
  minInterval: number;
  statusPages: number;
  customDomain: boolean;
  api: boolean;
};

// Plan limitleri tek yerde tutulur; arayüz, API ve webhook mantığı buradan okur
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: { monitors: 5, minInterval: 180, statusPages: 1, customDomain: false, api: false },
  PRO: { monitors: 50, minInterval: 60, statusPages: 5, customDomain: true, api: true },
  BUSINESS: { monitors: 200, minInterval: 30, statusPages: 20, customDomain: true, api: true },
};

export function limitsFor(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function assertMonitorQuota(plan: Plan, currentCount: number) {
  const limit = PLAN_LIMITS[plan].monitors;
  if (currentCount >= limit) {
    throw new PlanLimitError(`Your ${plan} plan allows up to ${limit} monitors. Upgrade to add more.`, "monitors");
  }
}

export function assertIntervalAllowed(plan: Plan, interval: number) {
  const min = PLAN_LIMITS[plan].minInterval;
  if (interval < min) {
    throw new PlanLimitError(`Your ${plan} plan supports checks every ${min} seconds or slower.`, "interval");
  }
}

export function assertStatusPageQuota(plan: Plan, currentCount: number) {
  const limit = PLAN_LIMITS[plan].statusPages;
  if (currentCount >= limit) {
    throw new PlanLimitError(`Your ${plan} plan allows up to ${limit} status pages.`, "statusPages");
  }
}

export function assertCustomDomainAllowed(plan: Plan) {
  if (!PLAN_LIMITS[plan].customDomain) {
    throw new PlanLimitError("Custom domains are available on Pro and Business plans.", "customDomain");
  }
}

export function assertApiAllowed(plan: Plan) {
  if (!PLAN_LIMITS[plan].api) {
    throw new PlanLimitError("API access is available on Pro and Business plans.", "api");
  }
}
