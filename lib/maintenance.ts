import { prisma } from "./prisma";

/** Monitör şu anda planlı bakımda mı? (uyarılar bu sürede susturulur, olay kaydı açılmaz) */
export async function isInMaintenance(monitorId: string, at: Date = new Date()): Promise<boolean> {
  const n = await prisma.maintenance.count({ where: { startsAt: { lte: at }, endsAt: { gt: at }, monitors: { some: { id: monitorId } } } });
  return n > 0;
}
