import { notFound } from "next/navigation";
import { requireUser } from "../auth/current-user";
import { prisma } from "../prisma";
import { isAdminEmail } from "./emails";

export { adminEmails, isAdminEmail } from "./emails";

/**
 * Yalnızca ADMIN_EMAIL'deki hesaplar geçer; diğerleri 404 alır (panelin varlığı bile gösterilmez).
 * Hem sayfalarda hem tüm admin sunucu eylemlerinde çağrılır: arayüzü gizlemek yetki kontrolü yerine geçmez.
 */
export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdminEmail(user.email)) notFound();
  return user;
}

/** Yönetici işlemini denetim günlüğüne yazar (kim, ne zaman, ne değişti). */
export async function logAdmin(adminId: string, action: string, metadata?: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: { userId: adminId, action: `admin.${action}`, metadata: metadata as object | undefined },
  });
}
