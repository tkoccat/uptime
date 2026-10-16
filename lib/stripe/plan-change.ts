import type { Plan } from "@prisma/client";
import { prisma } from "../prisma";
import { getLimits } from "../plans";
import { getAdapter } from "../uptime-kuma";

/**
 * Kullanıcının planını değiştirir. Yeni planın monitör limiti aşılıyorsa en eski monitörler
 * aktif kalır, fazlası duraklatılır (silinmez); kullanıcı yükseltince yeniden etkinleştirebilir.
 *
 * Yönetici planı elle verdiyse (planLocked) Stripe olayları planı değiştirmez; `force` ile (admin işlemi) geçilir.
 */
export async function applyPlan(userId: string, plan: Plan, opts: { force?: boolean } = {}) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { planLocked: true, plan: true } });
  if (user?.planLocked && !opts.force) return { paused: 0, skipped: true as const };

  await prisma.user.update({ where: { id: userId }, data: { plan } });
  return { ...(await enforceMonitorLimit(userId, plan)), skipped: false as const };
}

/** Plan limitini aşan fazla monitörleri duraklatır (en eskiler aktif kalır). */
export async function enforceMonitorLimit(userId: string, plan: Plan) {
  const limit = (await getLimits(plan)).monitors;
  const active = await prisma.monitor.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, uptimeKumaMonitorId: true },
  });
  const excess = active.slice(limit);
  if (excess.length === 0) return { paused: 0 };

  for (const m of excess) {
    await getAdapter().setMonitorActive(userId, m.uptimeKumaMonitorId, false);
  }
  await prisma.monitor.updateMany({ where: { id: { in: excess.map((m) => m.id) } }, data: { isActive: false } });
  return { paused: excess.length };
}
