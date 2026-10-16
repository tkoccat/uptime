import { prisma } from "../prisma";
import { renderEmail, type EmailTemplate } from "../email/render";
import { sendEmail } from "../email/send";
import { dispatchAlert, type AlertKind } from "../notify/dispatch";
import { shouldSendEmail } from "../notify/prefs";
import { queueUserEmail } from "../notify/user-email";
import { getAdapter } from "../uptime-kuma";

// Kuyruk işçisinin ve satır içi çalıştırmanın ortak iş işleyicisi
export async function processJob(name: string, data: Record<string, unknown>): Promise<void> {
  switch (name) {
    case "email":
      return sendTemplatedEmail(data as EmailJob);
    case "alert":
      return dispatchAlert(data as { monitorId: string; kind: AlertKind; message?: string; time: string });
    case "rollup":
      return rollupUptime();
    case "trial-reminders":
      return sendTrialReminders();
    default:
      throw new Error(`Bilinmeyen iş: ${name}`);
  }
}

type EmailJob = {
  userId: string;
  template: EmailTemplate;
  vars?: Record<string, string | number>;
  ctaPath?: string;
};

async function sendTemplatedEmail(job: EmailJob) {
  const user = await prisma.user.findUnique({ where: { id: job.userId } });
  if (!user) return;
  if (!shouldSendEmail(user.emailPrefs, job.template)) return;
  const email = await renderEmail({ template: job.template, locale: user.locale, vars: job.vars, ctaPath: job.ctaPath });
  await sendEmail(user.email, email);
}

// Her 5 dakikada: Kuma kalp atışlarını günlük up/down sayaçlarına işler (status page 90 günlük çubuk)
export async function rollupUptime() {
  const monitors = await prisma.monitor.findMany({ where: { isActive: true } });
  const adapter = getAdapter();

  for (const m of monitors) {
    try {
      const since = m.lastRollupAt ?? new Date(Date.now() - 24 * 3600_000);
      const hours = Math.max(1, Math.ceil((Date.now() - since.getTime()) / 3600_000) + 1);
      const beats = (await adapter.getMonitorHistory(m.userId, m.uptimeKumaMonitorId, hours)).filter(
        (b) => new Date(b.time) > since
      );
      if (beats.length === 0) continue;

      const perDay = new Map<string, { up: number; down: number }>();
      for (const b of beats) {
        if (b.status !== "up" && b.status !== "down") continue;
        const day = b.time.slice(0, 10);
        const entry = perDay.get(day) ?? { up: 0, down: 0 };
        entry[b.status] += 1;
        perDay.set(day, entry);
      }

      for (const [day, c] of perDay) {
        await prisma.monitorDaily.upsert({
          where: { monitorId_day: { monitorId: m.id, day: new Date(`${day}T00:00:00Z`) } },
          create: { monitorId: m.id, day: new Date(`${day}T00:00:00Z`), up: c.up, down: c.down },
          update: { up: { increment: c.up }, down: { increment: c.down } },
        });
      }
      const newest = beats[beats.length - 1].time;
      await prisma.monitor.update({ where: { id: m.id }, data: { lastRollupAt: new Date(newest) } });
    } catch (err) {
      console.error(`[rollup] ${m.id} işlenemedi`, err);
    }
  }
}

// Saatlik: deneme bitimine 3 gün veya daha az kalanlara tek seferlik hatırlatma
export async function sendTrialReminders() {
  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 24 * 3600_000);
  const subs = await prisma.subscription.findMany({
    where: { status: "TRIALING", trialReminderSentAt: null, trialEnd: { gt: now, lte: soon } },
  });
  for (const sub of subs) {
    const days = Math.max(1, Math.ceil((sub.trialEnd!.getTime() - now.getTime()) / 86_400_000));
    await queueUserEmail(sub.userId, "trial_ending", { days }, "/dashboard/billing");
    await prisma.subscription.update({ where: { id: sub.id }, data: { trialReminderSentAt: now } });
  }
}
