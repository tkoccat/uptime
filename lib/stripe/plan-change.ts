import type { Plan } from "@prisma/client";
import { prisma } from "../prisma";
import { limitsFor } from "../plans";
import { getAdapter } from "../uptime-kuma";

/**
 * Kullanıcının planını değiştirir. Yeni planın monitör limiti aşılıyorsa en eski monitörler
 * aktif kalır, fazlası duraklatılır (silinmez); kullanıcı yükseltince yeniden etkinleştirebilir.
 */
export async function applyPlan(userId: string, plan: Plan) {
  await prisma.user.update({ where: { id: userId }, data: { plan } });

  const limit = limitsFor(plan).monitors;
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
