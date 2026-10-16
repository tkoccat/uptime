"use server";

import { redirect as externalRedirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { isLocale } from "@/i18n/routing";
import { deleteAccount } from "@/lib/account";
import { createApiKey, revokeApiKey } from "@/lib/api-keys";
import { requireUser } from "@/lib/auth/current-user";
import { signToken } from "@/lib/crypto";
import { renderEmail } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/send";
import { AppError, PlanLimitError } from "@/lib/errors";
import { EMAIL_PREF_KEYS } from "@/lib/notify/prefs";
import { readChannelConfig, sendToExternalChannel } from "@/lib/notify/channels";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createCheckoutUrl, createPortalUrl } from "@/lib/stripe/checkout";
import { isCurrency, type Billing, type PaidPlan } from "@/lib/stripe/prices";
import type { NotificationType } from "@prisma/client";
import { readMonitorForm } from "@/lib/monitor-form";
import { zonedToUtc } from "@/lib/time";
import {
  createMaintenance,
  createMonitor,
  createNotificationChannel,
  createStatusPage,
  deleteMaintenance,
  deleteMonitor,
  setMonitorActive,
  updateMonitor,
} from "@/lib/uptimeKuma";

// --- Ortak yardımcılar ---

async function go(href: string): Promise<never> {
  redirect({ href, locale: await getLocale() });
  throw new Error("unreachable");
}

// Hata kodunu kullanıcıya gösterilecek anahtara çevirir (ayrıntı sızdırmaz)
function errorCode(err: unknown): string {
  if (err instanceof PlanLimitError) return `plan_limit_${err.limit}`;
  if (err instanceof AppError) return err.code;
  console.error("[dashboard] beklenmeyen hata", err);
  return "unknown";
}

/** İşi çalıştırır; hata olursa ?error=kod, başarıda ?ok=1 ile geri yönlendirir. */
async function run(path: string, work: () => Promise<void>): Promise<never> {
  let code: string | null = null;
  try {
    await work();
  } catch (err) {
    code = errorCode(err);
  }
  // redirect try/catch dışında olmalı (NEXT_REDIRECT yakalanmamalı)
  return go(code ? `${path}?error=${code}` : `${path}?ok=1`);
}

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "");

// --- Monitörler ---

export async function createMonitorAction(fd: FormData) {
  const user = await requireUser();
  await run("/dashboard/monitors", async () => {
    await createMonitor(user.id, readMonitorForm(fd));
  });
}

export async function updateMonitorAction(fd: FormData) {
  const user = await requireUser();
  const id = str(fd, "id");
  await run(`/dashboard/monitors/${id}`, async () => {
    await updateMonitor(user.id, id, readMonitorForm(fd));
  });
}

// --- Planlı bakım ---

export async function createMaintenanceAction(fd: FormData) {
  const user = await requireUser();
  await run("/dashboard/maintenance", async () => {
    // Tarayıcı yerel saati ("datetime-local") kullanıcının saat dilimi olarak yorumlanır
    const toDate = (key: string) => zonedToUtc(str(fd, key), user.timezone);
    await createMaintenance(user.id, {
      title: str(fd, "title"),
      startsAt: toDate("startsAt"),
      endsAt: toDate("endsAt"),
      monitorIds: fd.getAll("monitorIds").map(String),
    });
  });
}

export async function deleteMaintenanceAction(fd: FormData) {
  const user = await requireUser();
  await run("/dashboard/maintenance", () => deleteMaintenance(user.id, str(fd, "id")));
}

export async function deleteMonitorAction(fd: FormData) {
  const user = await requireUser();
  await run("/dashboard/monitors", () => deleteMonitor(user.id, str(fd, "id")));
}

export async function toggleMonitorAction(fd: FormData) {
  const user = await requireUser();
  const id = str(fd, "id");
  // Listeden gelen istek listeye, detay sayfasından gelen detaya döner
  await run(str(fd, "back") === "list" ? "/dashboard/monitors" : `/dashboard/monitors/${id}`, async () => {
    await setMonitorActive(user.id, id, str(fd, "active") === "true");
  });
}

// --- Durum sayfaları ---

export async function createStatusPageAction(fd: FormData) {
  const user = await requireUser();
  await run("/dashboard/status-pages", async () => {
    await createStatusPage(user.id, {
      slug: str(fd, "slug"),
      title: str(fd, "title"),
      monitorIds: fd.getAll("monitorIds").map(String),
      customDomain: str(fd, "customDomain") || undefined,
    });
  });
}

export async function deleteStatusPageAction(fd: FormData) {
  const user = await requireUser();
  await run("/dashboard/status-pages", async () => {
    // userId koşulu: başkasının sayfası silinemez
    await prisma.statusPage.deleteMany({ where: { id: str(fd, "id"), userId: user.id } });
  });
}

// --- Bildirim kanalları ---

async function sendVerificationEmail(userId: string, locale: string, channelId: string, to: string) {
  // Başkalarına istenmeyen e-posta göndermek için kötüye kullanılmasın
  await enforceRateLimit(`verify:${userId}`, 10, 3600);
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const ctaUrl = `${base}/api/channels/verify?token=${encodeURIComponent(signToken(channelId))}`;
  const email = await renderEmail({ template: "verify_email", locale, vars: { email: to }, ctaUrl });
  await sendEmail(to, email);
}

export async function createChannelAction(fd: FormData) {
  const user = await requireUser();
  const type = str(fd, "type") as NotificationType;
  // Her tür yalnızca kendi alanlarını kullanır; formdaki diğer alanlar yok sayılır
  const config =
    type === "EMAIL"
      ? { email: str(fd, "email") }
      : type === "WEBHOOK"
        ? { url: str(fd, "webhookUrl") }
        : type === "SLACK" || type === "DISCORD" || type === "TEAMS" || type === "GOOGLE_CHAT"
          ? { webhookUrl: str(fd, "webhookUrl").trim() }
          : type === "TELEGRAM"
            ? { botToken: str(fd, "botToken").trim(), chatId: str(fd, "chatId").trim() }
            : type === "NTFY"
              ? { serverUrl: str(fd, "serverUrl").trim(), topic: str(fd, "topic").trim(), token: str(fd, "token").trim() }
              : type === "PUSHOVER"
                ? { userKey: str(fd, "userKey").trim(), appToken: str(fd, "appToken").trim() }
                : { phone: str(fd, "phone") };

  await run("/dashboard/notifications", async () => {
    const channel = await createNotificationChannel(user.id, { type, name: str(fd, "name"), config });
    // E-posta kanalı: adrese ait olduğunu kanıtlayan doğrulama bağlantısı gönderilir
    if (type === "EMAIL") {
      await sendVerificationEmail(user.id, user.locale, channel.id, (config as { email: string }).email);
    }
  });
}

export async function deleteChannelAction(fd: FormData) {
  const user = await requireUser();
  await run("/dashboard/notifications", async () => {
    await prisma.notificationChannel.deleteMany({ where: { id: str(fd, "id"), userId: user.id } });
  });
}

export async function testChannelAction(fd: FormData) {
  const user = await requireUser();
  const channel = await prisma.notificationChannel.findFirst({ where: { id: str(fd, "id"), userId: user.id } });
  let failed = false;

  try {
    if (!channel) throw new AppError("not found", "not_found", 404);
    if (channel.type === "EMAIL") {
      const to = readChannelConfig(channel).email;
      if (to) await sendVerificationEmail(user.id, user.locale, channel.id, to);
    } else {
      await sendToExternalChannel(channel, {
        event: "test",
        title: "Test notification",
        text: "This is a test from your monitoring dashboard.",
        time: new Date().toISOString(),
      });
      // Başarılı test gönderimi kanalı doğrulanmış sayar
      await prisma.notificationChannel.update({ where: { id: channel.id }, data: { isVerified: true } });
    }
  } catch (err) {
    console.error("[channel test]", err);
    failed = true;
  }
  return go(`/dashboard/notifications?${failed ? "test=failed" : "test=sent"}`);
}

// --- Ayarlar ---

export async function updateSettingsAction(fd: FormData) {
  const user = await requireUser();
  const locale = str(fd, "locale");
  const timezone = str(fd, "timezone");

  // Geçersiz saat dilimi Intl'de hata verir; kabul edilmeden önce doğrulanır
  let validTz = true;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    validTz = false;
  }

  const prefs = Object.fromEntries(EMAIL_PREF_KEYS.map((k) => [k, fd.get(`pref_${k}`) === "on"]));

  await run("/dashboard/settings", async () => {
    if (!validTz || !isLocale(locale)) throw new AppError("invalid", "validation", 400);
    await prisma.user.update({
      where: { id: user.id },
      data: { name: str(fd, "name").trim().slice(0, 100) || null, locale, timezone, emailPrefs: prefs },
    });
  });
}

export async function deleteAccountAction(fd: FormData) {
  const user = await requireUser();
  if (str(fd, "confirm") !== "DELETE") return go("/dashboard/settings?error=validation");

  try {
    await deleteAccount(user.id);
  } catch (err) {
    return go(`/dashboard/settings?error=${errorCode(err)}`);
  }
  // Hesap silindi: oturum çerezleri artık geçersiz, ana sayfaya dönülür
  return go("/");
}

// --- Faturalama ---

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function checkoutAction(fd: FormData) {
  const user = await requireUser();
  const plan = str(fd, "plan") as PaidPlan;
  const billing = str(fd, "billing") as Billing;
  const currency = str(fd, "currency");
  if (!["PRO", "BUSINESS"].includes(plan) || !["monthly", "yearly"].includes(billing)) {
    return go("/dashboard/billing?error=validation");
  }

  let url: string;
  try {
    url = await createCheckoutUrl({
      user,
      plan,
      billing,
      currency: isCurrency(currency) ? currency : undefined,
      appUrl: appUrl(),
    });
  } catch (err) {
    return go(`/dashboard/billing?error=${errorCode(err)}`);
  }
  externalRedirect(url);
}

export async function portalAction() {
  const user = await requireUser();
  let url: string;
  try {
    url = await createPortalUrl(user, appUrl());
  } catch (err) {
    return go(`/dashboard/billing?error=${errorCode(err)}`);
  }
  externalRedirect(url);
}

// --- API anahtarları ---

export type ApiKeyState = { key?: string; error?: string };

// useFormState ile kullanılır: düz anahtar URL'ye değil, yalnızca bu yanıta yazılır
export async function createApiKeyAction(_prev: ApiKeyState, fd: FormData): Promise<ApiKeyState> {
  const user = await requireUser();
  try {
    const { key } = await createApiKey(user.id, str(fd, "name"));
    return { key };
  } catch (err) {
    return { error: errorCode(err) };
  }
}

export async function revokeApiKeyAction(fd: FormData) {
  const user = await requireUser();
  await run("/dashboard/api", () => revokeApiKey(user.id, str(fd, "id")));
}
