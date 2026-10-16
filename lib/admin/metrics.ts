import type { Plan } from "@prisma/client";
import { prisma } from "../prisma";
import { planPrices } from "../marketing/content";
import { billingFromPriceId } from "../stripe/prices";

// Aylık eşdeğer liste fiyatı (GBP). EUR/USD abonelikler de bu liste fiyatıyla yaklaşık hesaplanır.
export function monthlyValue(plan: Plan, billing: "monthly" | "yearly"): number {
  const p = planPrices.find((x) => x.id === plan.toLowerCase());
  if (!p) return 0;
  return billing === "yearly" ? p.yearly / 12 : p.monthly;
}

type SubLite = { plan: Plan; stripePriceId: string };

/** Ücretli aktif aboneliklerin aylık yinelenen geliri (deneme dönemindekiler dahil değildir). */
export function computeMrr(subs: SubLite[], billingOf: (priceId: string) => "monthly" | "yearly" | null = billingFromPriceId): number {
  return subs.reduce((sum, s) => sum + monthlyValue(s.plan, billingOf(s.stripePriceId) ?? "monthly"), 0);
}

/** Churn: son N günde iptal edilenler / (dönem başındaki aktifler). Aktif yoksa null. */
export function computeChurn(activeNow: number, canceledInWindow: number): number | null {
  const base = activeNow + canceledInWindow;
  return base === 0 ? null : (canceledInWindow / base) * 100;
}

export async function loadAdminMetrics() {
  const now = Date.now();
  const d7 = new Date(now - 7 * 86_400_000);
  const d30 = new Date(now - 30 * 86_400_000);

  const [totalUsers, signups7, signups30, planGroups, sources, paying, trialing, canceled30, activeUsers] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: d7 } } }),
    prisma.user.count({ where: { createdAt: { gte: d30 } } }),
    prisma.user.groupBy({ by: ["plan"], _count: { _all: true } }),
    prisma.user.groupBy({ by: ["utmSource"], _count: { _all: true }, orderBy: { _count: { utmSource: "desc" } }, take: 15 }),
    prisma.subscription.findMany({ where: { status: { in: ["ACTIVE", "PAST_DUE"] } }, select: { plan: true, stripePriceId: true } }),
    prisma.subscription.count({ where: { status: "TRIALING" } }),
    prisma.subscription.count({ where: { canceledAt: { gte: d30 } } }),
    prisma.usageLog.findMany({ where: { createdAt: { gte: d30 } }, distinct: ["userId"], select: { userId: true } }),
  ]);

  return {
    totalUsers,
    signups7,
    signups30,
    activeUsers30: activeUsers.length,
    plans: planGroups.map((g) => ({ plan: g.plan, count: g._count._all })),
    sources: sources.map((s) => ({ source: s.utmSource ?? "(unknown / no consent)", count: s._count._all })),
    payingCount: paying.length,
    trialing,
    mrr: computeMrr(paying),
    churn30: computeChurn(paying.length, canceled30),
  };
}
