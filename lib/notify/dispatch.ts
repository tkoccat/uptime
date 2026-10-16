import { isInMaintenance } from "../maintenance";
import { prisma } from "../prisma";
import { renderEmail, type EmailTemplate } from "../email/render";
import { sendEmail } from "../email/send";
import { readChannelConfig, sendToExternalChannel, type AlertPayload } from "./channels";
import { shouldSendEmail } from "./prefs";

export type AlertKind = "down" | "up";

// Kuma webhook'undan gelen bir olayı ilgili kullanıcının tüm kanallarına dağıtır
export async function dispatchAlert(params: { monitorId: string; kind: AlertKind; message?: string; time: string }) {
  const monitor = await prisma.monitor.findUnique({
    where: { id: params.monitorId },
    include: { user: true },
  });
  if (!monitor) return; // monitör bu arada silinmiş olabilir

  // Planlı bakım sırasında ne olay kaydı açılır ne de bildirim gider
  if (await isInMaintenance(monitor.id, new Date(params.time))) return;

  // Olay geçmişi (status page'deki incident listesi)
  if (params.kind === "down") {
    const open = await prisma.incident.findFirst({ where: { monitorId: monitor.id, resolvedAt: null } });
    if (!open) {
      await prisma.incident.create({
        data: { monitorId: monitor.id, startedAt: new Date(params.time), message: params.message?.slice(0, 500) },
      });
    }
  } else {
    await prisma.incident.updateMany({
      where: { monitorId: monitor.id, resolvedAt: null },
      data: { resolvedAt: new Date(params.time) },
    });
  }

  const template: EmailTemplate = params.kind === "down" ? "monitor_down" : "monitor_up";
  const vars = {
    monitor: monitor.name,
    url: monitor.url,
    reason: params.message ?? "unknown",
    time: new Date(params.time).toLocaleString(monitor.user.locale, { timeZone: monitor.user.timezone }),
  };
  const ctaPath = `/dashboard/monitors/${monitor.id}`;

  // 1) Hesap sahibine e-posta (tercihine göre)
  if (shouldSendEmail(monitor.user.emailPrefs, template)) {
    const email = await renderEmail({ template, locale: monitor.user.locale, vars, ctaPath });
    await sendEmail(monitor.user.email, email).catch((e) => console.error("[alert] hesap e-postası gönderilemedi", e));
  }

  // 2) Doğrulanmış ek kanallar
  const payload: AlertPayload = {
    event: params.kind === "down" ? "monitor.down" : "monitor.up",
    title: params.kind === "down" ? `${monitor.name} is down` : `${monitor.name} is back up`,
    text: params.kind === "down" ? `${monitor.url} — ${vars.reason}` : `${monitor.url} is responding again`,
    monitor: { id: monitor.id, name: monitor.name, url: monitor.url },
    time: params.time,
  };

  const channels = await prisma.notificationChannel.findMany({ where: { userId: monitor.userId, isVerified: true } });
  await Promise.all(
    channels.map(async (channel) => {
      try {
        if (channel.type === "EMAIL") {
          const to = readChannelConfig(channel).email;
          if (to) await sendEmail(to, await renderEmail({ template, locale: monitor.user.locale, vars, ctaPath }));
        } else {
          await sendToExternalChannel(channel, payload);
        }
      } catch (err) {
        // Bir kanalın hatası diğerlerini ve işin yeniden denenmesini (çift bildirim) engellemez
        console.error(`[alert] kanal gönderilemedi (${channel.type} ${channel.id})`, err);
      }
    })
  );
}
