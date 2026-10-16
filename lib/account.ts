import { createClient as createAdminClient } from "@supabase/supabase-js";
import { AppError, NotFoundError } from "./errors";
import { prisma } from "./prisma";
import { getStripe } from "./stripe/client";
import { getAdapter } from "./uptime-kuma";

/**
 * "Hesabımı sil": Uptime Kuma verisi, Stripe abonelikleri, Supabase hesabı ve tüm SaaS verisi silinir.
 * Uptime Kuma silinemezse DB'ye dokunulmaz ve hata fırlatılır; kullanıcı tekrar deneyebilir
 * (yarım silme ve yetim veri bırakmamak için).
 * Not: Stripe faturaları vergi mevzuatı gereği Stripe'ta saklanır (Gizlilik Politikası'nda belirtilmiştir).
 */
export async function deleteAccount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { monitors: true } });
  if (!user) throw new NotFoundError();

  await prisma.auditLog.create({ data: { userId, action: "account.delete.started" } });

  // 1) Uptime Kuma monitörleri
  const failed: string[] = [];
  for (const m of user.monitors) {
    try {
      await getAdapter().deleteMonitor(userId, m.uptimeKumaMonitorId);
    } catch (err) {
      // Kuma'da zaten yoksa sorun değil
      if (!/not found|no such|does not exist/i.test(String((err as Error).message))) failed.push(m.id);
    }
  }
  if (failed.length > 0) {
    throw new AppError("Could not remove all monitoring data. Please try again.", "delete_incomplete", 502);
  }

  // 2) Stripe: aktif abonelikleri iptal et (müşteri kaydı fatura saklama için kalır)
  if (user.stripeCustomerId) {
    const stripe = getStripe();
    const subs = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: "all", limit: 20 });
    for (const s of subs.data) {
      if (s.status !== "canceled" && s.status !== "incomplete_expired") await stripe.subscriptions.cancel(s.id);
    }
  }

  // 3) Supabase Auth hesabı
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { error } = await admin.auth.admin.deleteUser(user.supabaseId);
  if (error && !/not found/i.test(error.message)) {
    throw new AppError("Could not delete the sign-in account. Please try again.", "delete_incomplete", 502);
  }

  // 4) SaaS verisi (ilişkili tüm kayıtlar cascade ile silinir; AuditLog.userId null'a döner)
  await prisma.user.delete({ where: { id: userId } });
}
