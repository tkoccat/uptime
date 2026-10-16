"use server";

import type { Plan } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { isLocale, routing } from "@/i18n/routing";
import { loadMessages } from "@/i18n/messages";
import { logAdmin, requireAdmin } from "@/lib/admin/guard";
import { createDiscount, deactivateDiscount, setAutoDiscount, setDiscountActive } from "@/lib/admin/coupons";
import { getStripe } from "@/lib/stripe/client";
import { clearStripeKeys, isStripeConfigured, saveStripeKeys, validateStripeKeyShapes } from "@/lib/stripe/config";
import { CONTENT_KEYS, fromEditorText, getByPath, toEditorText } from "@/lib/admin/content-keys";
import { parseMoney, savePlanConfig } from "@/lib/admin/pricing";
import { deleteUserByAdmin, extendTrial, setSuspended, setUserPlan, unlockUserPlan } from "@/lib/admin/users";
import { AppError } from "@/lib/errors";
import { invalidatePlanConfigs } from "@/lib/plan-config";
import { prisma } from "@/lib/prisma";
import { invalidateSiteConfig } from "@/lib/site-config";

// Her eylem ilk iş olarak yönetici kontrolü yapar: arayüzü gizlemek yetki kontrolü yerine geçmez.

async function go(href: string): Promise<never> {
  redirect({ href, locale: await getLocale() });
  throw new Error("unreachable");
}

/** İşi çalıştırır; sonucu ?ok=mesaj veya ?error=mesaj ile geri bildirir. */
async function run(path: string, work: () => Promise<string | void>): Promise<never> {
  let query: string;
  try {
    const msg = (await work()) || "Saved";
    query = `ok=${encodeURIComponent(msg.slice(0, 300))}`;
  } catch (err) {
    // Yönetici arayüzü olduğundan Stripe/doğrulama hata mesajları olduğu gibi gösterilir
    const msg = err instanceof Error && (err instanceof AppError || err.name.includes("Stripe") || (err as { type?: string }).type) ? err.message : "Unexpected error (see server logs)";
    if (!(err instanceof AppError)) console.error("[admin] hata", err);
    query = `error=${encodeURIComponent(msg.slice(0, 300))}`;
  }
  return go(`${path}${path.includes("?") ? "&" : "?"}${query}`);
}

// Fiyat, içerik ve ayar değişikliklerinin herkese açık sayfalara hemen yansıması için
function refreshSite() {
  invalidatePlanConfigs();
  invalidateSiteConfig();
  revalidatePath("/", "layout");
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const num = (fd: FormData, k: string) => Number(str(fd, k));
const bool = (fd: FormData, k: string) => fd.get(k) === "on";

// --- Planlar ve fiyatlar ---

export async function savePlanAction(fd: FormData) {
  const admin = await requireAdmin();
  const plan = str(fd, "plan") as Plan;
  await run("/admin/plans", async () => {
    if (!["FREE", "PRO", "BUSINESS"].includes(plan)) throw new AppError("Unknown plan", "validation", 400);
    const result = await savePlanConfig(plan, {
      priceMonthly: parseMoney(str(fd, "priceMonthly")) ?? 0,
      priceYearly: parseMoney(str(fd, "priceYearly")) ?? 0,
      eurMonthly: parseMoney(str(fd, "eurMonthly")),
      eurYearly: parseMoney(str(fd, "eurYearly")),
      usdMonthly: parseMoney(str(fd, "usdMonthly")),
      usdYearly: parseMoney(str(fd, "usdYearly")),
      monitors: num(fd, "monitors"),
      minInterval: num(fd, "minInterval"),
      statusPages: num(fd, "statusPages"),
      customDomain: bool(fd, "customDomain"),
      api: bool(fd, "api"),
      trialDays: num(fd, "trialDays"),
      highlight: bool(fd, "highlight"),
      isActive: bool(fd, "isActive"),
    });
    await logAdmin(admin.id, "plan.update", { plan, before: result.before, after: result.after });
    refreshSite();
    return result.warnings.length ? `Saved. ${result.warnings.join(" ")}` : `${plan} plan saved`;
  });
}

// --- İndirimler ---

export async function createDiscountAction(fd: FormData) {
  const admin = await requireAdmin();
  await run("/admin/discounts", async () => {
    const kind = str(fd, "kind") === "amount" ? "amount" : "percent";
    const expires = str(fd, "expiresAt");
    const result = await createDiscount({
      code: str(fd, "code"),
      kind,
      percentOff: kind === "percent" ? num(fd, "value") : undefined,
      amountOff: kind === "amount" ? parseMoney(str(fd, "value")) ?? undefined : undefined,
      duration: str(fd, "duration"),
      months: str(fd, "months") ? num(fd, "months") : undefined,
      maxRedemptions: str(fd, "maxRedemptions") ? num(fd, "maxRedemptions") : undefined,
      expiresAt: expires ? new Date(`${expires}T23:59:59Z`) : undefined,
      plans: fd.getAll("plans").map(String),
      firstTimeOnly: bool(fd, "firstTimeOnly"),
    });
    await logAdmin(admin.id, "discount.create", { code: result.code });
    return `Discount code ${result.code} created`;
  });
}

export async function deactivateDiscountAction(fd: FormData) {
  const admin = await requireAdmin();
  await run("/admin/discounts", async () => {
    await deactivateDiscount(str(fd, "id"));
    await logAdmin(admin.id, "discount.deactivate", { id: str(fd, "id") });
    return "Discount code deactivated";
  });
}

export async function reactivateDiscountAction(fd: FormData) {
  const admin = await requireAdmin();
  await run("/admin/discounts", async () => {
    await setDiscountActive(str(fd, "id"), true);
    await logAdmin(admin.id, "discount.reactivate", { id: str(fd, "id") });
    return "Discount code re-activated";
  });
}

// Otomatik indirim: seçilen kod tüm ödemelere uygulanır; boş değer kapatır
export async function setAutoDiscountAction(fd: FormData) {
  const admin = await requireAdmin();
  await run("/admin/discounts", async () => {
    const id = str(fd, "id");
    await setAutoDiscount(id || null);
    await logAdmin(admin.id, "discount.auto", { id: id || null });
    refreshSite();
    return id ? "Automatic discount turned on: it now applies to every checkout" : "Automatic discount turned off";
  });
}

// --- Entegrasyonlar (Stripe) ---

export async function saveStripeKeysAction(fd: FormData) {
  const admin = await requireAdmin();
  await run("/admin/integrations", async () => {
    const input = { secretKey: str(fd, "secretKey").trim(), webhookSecret: str(fd, "webhookSecret").trim(), publishableKey: str(fd, "publishableKey").trim() };
    const problem = validateStripeKeyShapes(input);
    if (problem) throw new AppError(problem, "validation", 400);
    if (!input.secretKey && !input.webhookSecret && !input.publishableKey) throw new AppError("Enter at least one key", "validation", 400);
    await saveStripeKeys(input);
    // Anahtarlar değerleri loglanmadan yalnızca hangi alanların değiştiği kaydedilir
    await logAdmin(admin.id, "stripe.keys", { secretKey: Boolean(input.secretKey), webhookSecret: Boolean(input.webhookSecret), publishableKey: Boolean(input.publishableKey) });
    refreshSite();
    return "Stripe keys saved. Use “Test connection” to verify.";
  });
}

export async function clearStripeKeysAction() {
  const admin = await requireAdmin();
  await run("/admin/integrations", async () => {
    await clearStripeKeys();
    await logAdmin(admin.id, "stripe.keys.clear", {});
    return "Keys saved in the admin panel were removed (environment variables are used again, if set)";
  });
}

export async function testStripeAction() {
  await requireAdmin();
  await run("/admin/integrations", async () => {
    if (!(await isStripeConfigured())) throw new AppError("Add a secret key first", "validation", 400);
    const balance = await (await getStripe()).balance.retrieve();
    return `Stripe connected (${balance.livemode ? "LIVE" : "test"} mode)`;
  });
}

// --- Kullanıcılar ---

export async function setUserPlanAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  await run(`/admin/users/${id}`, async () => {
    const plan = str(fd, "plan") as Plan;
    if (!["FREE", "PRO", "BUSINESS"].includes(plan)) throw new AppError("Unknown plan", "validation", 400);
    const lock = bool(fd, "lock");
    await setUserPlan(id, plan, lock);
    await logAdmin(admin.id, "user.plan", { userId: id, plan, lock });
    return `Plan set to ${plan}${lock ? " (locked: Stripe events will not change it)" : ""}`;
  });
}

export async function unlockUserPlanAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  await run(`/admin/users/${id}`, async () => {
    await unlockUserPlan(id);
    await logAdmin(admin.id, "user.unlock", { userId: id });
    return "Plan unlocked and re-synced with the subscription";
  });
}

export async function suspendUserAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const suspend = str(fd, "suspend") === "true";
  await run(`/admin/users/${id}`, async () => {
    await setSuspended(id, suspend);
    await logAdmin(admin.id, suspend ? "user.suspend" : "user.unsuspend", { userId: id });
    return suspend ? "Account suspended and monitors paused" : "Account re-enabled";
  });
}

export async function extendTrialAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  await run(`/admin/users/${id}`, async () => {
    const until = await extendTrial(id, num(fd, "days"));
    await logAdmin(admin.id, "user.trial", { userId: id, until: until.toISOString() });
    return `Trial extended until ${until.toISOString().slice(0, 10)}`;
  });
}

export async function deleteUserAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  let email = "";
  let failure: string | null = null;
  try {
    email = await deleteUserByAdmin(id, str(fd, "confirmEmail"));
    await logAdmin(admin.id, "user.delete", { email });
  } catch (err) {
    failure = err instanceof AppError ? err.message : "Could not delete the user (see server logs)";
    if (!(err instanceof AppError)) console.error("[admin] kullanıcı silinemedi", err);
  }
  return failure ? go(`/admin/users/${id}?error=${encodeURIComponent(failure)}`) : go(`/admin/users?ok=${encodeURIComponent(`Deleted ${email}`)}`);
}

// --- Site içeriği ---

export async function saveContentAction(fd: FormData) {
  const admin = await requireAdmin();
  const locale = str(fd, "locale");
  await run(`/admin/content?locale=${isLocale(locale) ? locale : routing.defaultLocale}`, async () => {
    if (!isLocale(locale)) throw new AppError("Unknown language", "validation", 400);
    const defaults = await loadMessages(locale);

    for (const def of CONTENT_KEYS) {
      const text = str(fd, `c:${def.key}`);
      const defaultText = toEditorText(def.kind, getByPath(defaults, def.key)).replace(/\r\n/g, "\n").trim();
      const same = text.replace(/\r\n/g, "\n").trim() === defaultText;
      const value = same ? null : fromEditorText(def.kind, text);

      if (value === null) {
        await prisma.siteContent.deleteMany({ where: { key: def.key, locale } });
      } else {
        await prisma.siteContent.upsert({
          where: { key_locale: { key: def.key, locale } },
          create: { key: def.key, locale, value: value as object },
          update: { value: value as object },
        });
      }
    }
    await logAdmin(admin.id, "content.update", { locale });
    refreshSite();
    return `Content saved (${locale})`;
  });
}

// --- Genel ayarlar ---

async function putSetting(key: string, value: object) {
  await prisma.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

export async function saveSettingsAction(fd: FormData) {
  const admin = await requireAdmin();
  await run("/admin/settings", async () => {
    const text: Record<string, string> = {};
    for (const l of routing.locales) {
      const v = str(fd, `announcement_${l}`).trim().slice(0, 300);
      if (v) text[l] = v;
    }
    const tone = ["info", "sale", "warning"].includes(str(fd, "tone")) ? str(fd, "tone") : "info";
    const link = str(fd, "announcementLink").trim();
    if (link && !/^(\/|https:\/\/)/.test(link)) throw new AppError("Announcement link must start with / or https://", "validation", 400);

    await putSetting("announcement", { enabled: bool(fd, "announcementEnabled"), tone, text, link });
    await putSetting("signups", { enabled: bool(fd, "signupsEnabled") });

    const company: Record<string, string> = {};
    for (const k of ["productName", "legalName", "companyNumber", "address", "supportEmail"]) {
      const v = str(fd, `company_${k}`).trim().slice(0, 300);
      if (v) company[k] = v;
    }
    await putSetting("company", company);

    await logAdmin(admin.id, "settings.update", { signups: bool(fd, "signupsEnabled"), announcement: bool(fd, "announcementEnabled"), company });
    refreshSite();
    return "Settings saved";
  });
}
