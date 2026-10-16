import type { Plan, Prisma } from "@prisma/client";
import { deleteAccount } from "../account";
import { AppError, NotFoundError, ValidationError } from "../errors";
import { prisma } from "../prisma";
import { getStripe } from "../stripe/client";
import { applyPlan, enforceMonitorLimit } from "../stripe/plan-change";
import { getAdapter } from "../uptime-kuma";
import { isAdminEmail } from "./guard";

export const PAGE_SIZE = 25;

export type UserFilter = { q?: string; plan?: Plan; page?: number };

export async function listUsers(filter: UserFilter) {
  const where: Prisma.UserWhereInput = {
    ...(filter.q ? { email: { contains: filter.q.trim(), mode: "insensitive" } } : {}),
    ...(filter.plan ? { plan: filter.plan } : {}),
  };
  const page = Math.max(1, filter.page ?? 1);
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { _count: { select: { monitors: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  return { users, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getUserDetail(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      subscriptions: { orderBy: { currentPeriodEnd: "desc" }, take: 5 },
      monitors: { orderBy: { createdAt: "desc" }, take: 20 },
      _count: { select: { monitors: true, apiKeys: true, statusPages: true, notificationChannels: true } },
    },
  });
  if (!user) throw new NotFoundError("User not found");
  return user;
}

/** Planı elle verir. `lock` açıksa Stripe olayları bu kullanıcının planını değiştirmez (hediye/özel plan). */
export async function setUserPlan(userId: string, plan: Plan, lock: boolean) {
  await getUserDetail(userId);
  await prisma.user.update({ where: { id: userId }, data: { planLocked: lock } });
  return applyPlan(userId, plan, { force: true });
}

/** Kilidi kaldırır ve planı aktif aboneliğe göre yeniden belirler (abonelik yoksa Free). */
export async function unlockUserPlan(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { planLocked: false } });
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] } },
    orderBy: { currentPeriodEnd: "desc" },
  });
  return applyPlan(userId, sub?.plan ?? "FREE", { force: true });
}

/** Hesabı askıya alır: giriş/API kapanır ve monitörler duraklatılır. Kaldırınca monitörler yeniden açılır. */
export async function setSuspended(userId: string, suspended: boolean) {
  const user = await getUserDetail(userId);
  if (suspended && isAdminEmail(user.email)) throw new ValidationError("Admin accounts cannot be suspended");

  await prisma.user.update({ where: { id: userId }, data: { suspendedAt: suspended ? new Date() : null } });

  const monitors = await prisma.monitor.findMany({ where: { userId }, select: { id: true, uptimeKumaMonitorId: true } });
  for (const m of monitors) {
    await getAdapter().setMonitorActive(userId, m.uptimeKumaMonitorId, !suspended);
  }
  await prisma.monitor.updateMany({ where: { userId }, data: { isActive: !suspended } });
  // Yeniden açarken plan limitini aşan fazla monitör tekrar duraklatılır
  if (!suspended) await enforceMonitorLimit(userId, user.plan);
}

/** Deneme süresini uzatır (yalnızca TRIALING aboneliği olan kullanıcılar için; Stripe'ta da güncellenir). */
export async function extendTrial(userId: string, days: number) {
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new ValidationError("Days must be between 1 and 90");
  const sub = await prisma.subscription.findFirst({ where: { userId, status: "TRIALING" }, orderBy: { currentPeriodEnd: "desc" } });
  if (!sub) throw new AppError("This user has no trial in progress", "no_trial", 400);

  const from = Math.max(Date.now(), sub.trialEnd?.getTime() ?? 0);
  const next = new Date(from + days * 86_400_000);
  await (await getStripe()).subscriptions.update(sub.stripeSubscriptionId, {
    trial_end: Math.floor(next.getTime() / 1000),
    proration_behavior: "none",
  });
  await prisma.subscription.update({ where: { id: sub.id }, data: { trialEnd: next, trialReminderSentAt: null } });
  return next;
}

/** Kullanıcıyı ve tüm verisini siler (Kuma, Stripe abonelikleri, Supabase hesabı dahil). */
export async function deleteUserByAdmin(userId: string, confirmEmail: string) {
  const user = await getUserDetail(userId);
  if (isAdminEmail(user.email)) throw new ValidationError("Admin accounts cannot be deleted here");
  if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) throw new ValidationError("Type the user's email to confirm");
  await deleteAccount(userId);
  return user.email;
}
