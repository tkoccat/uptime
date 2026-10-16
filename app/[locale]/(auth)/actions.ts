"use server";

import { cookies, headers } from "next/headers";
import { SIGNUP_SOURCE_COOKIE, parseSignupSource } from "@/lib/signup-source";
import { redirect as externalRedirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { intentPath, parsePlanIntent, type PlanIntent } from "@/lib/auth/intent";
import { mapSupabaseError, safeNextPath } from "@/lib/auth/messages";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { signupsEnabled } from "@/lib/site-config";

function siteUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? `http://${headers().get("host")}`;
}

// Dil ön ekini otomatik ekleyen yönlendirme
async function go(href: string): Promise<never> {
  redirect({ href, locale: await getLocale() });
  throw new Error("unreachable");
}

async function fail(path: string, code: string): Promise<never> {
  return go(`${path}?error=${code}`);
}

// Supabase yapılandırılmamışsa (ilk kurulum) sunucu hatası yerine anlaşılır bir mesajla geri dön
async function requireConfigured(path: string) {
  if (!isSupabaseConfigured()) await fail(path, "not_configured");
}

// Doğrulama/OAuth dönüş adresi; plan niyeti varsa `next` ile taşınır (geçersiz değerler yok sayılır)
function callbackUrl(intent: PlanIntent | null) {
  const base = `${siteUrl()}/auth/callback`;
  return intent ? `${base}?next=${encodeURIComponent(intentPath(intent))}` : base;
}

function sourceMetadata() {
  const src = parseSignupSource(cookies().get(SIGNUP_SOURCE_COOKIE)?.value);
  return { utm_source: src.utmSource, utm_medium: src.utmMedium, utm_campaign: src.utmCampaign, referrer: src.referrer };
}

// Kaba kuvvet ve toplu kayıt denemelerine karşı IP başına sınır
async function guard(path: string, kind: string) {
  await requireConfigured(path);
  const res = await rateLimit(`auth:${kind}:${getClientIp()}`, LIMITS.auth.limit, LIMITS.auth.windowSec);
  if (!res.ok) await fail(path, "rate_limited");
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));
  await guard("/login", "signin");
  if (!email || !password) await fail("/login", "missing_fields");

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) await fail("/login", mapSupabaseError(error));

  await go(next);
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  await guard("/register", "signup");
  // Admin panelinden yeni kayıtlar kapatılabilir
  if (!(await signupsEnabled())) await fail("/register", "signups_closed");
  if (!email || !password) await fail("/register", "missing_fields");
  if (password.length < 8) await fail("/register", "weak_password");
  if (password !== confirm) await fail("/register", "password_mismatch");

  const locale = await getLocale();
  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Fiyat sayfasından geldiyse doğrulama sonrası doğrudan seçilen planın ödeme adımına gidilir
      emailRedirectTo: callbackUrl(parsePlanIntent(formData.get("plan"), formData.get("billing"))),
      // Dil tercihi kullanıcı verisine yazılır; callback'te veritabanına aktarılır (e-postalar bu dilde gider)
      data: {
        locale,
        // Kaynak çerezi yalnızca çerez onayı verildiyse vardır (bkz. components/tracking)
        ...sourceMetadata(),
      },
    },
  });
  if (error) await fail("/register", mapSupabaseError(error));

  // E-posta doğrulaması zorunlu: kullanıcıdan gelen maili onaylaması istenir
  await go("/login?info=check_email");
}

export async function signInWithGoogle(formData?: FormData) {
  await requireConfigured("/login");
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(parsePlanIntent(formData?.get("plan"), formData?.get("billing"))) },
  });
  if (error || !data.url) return fail("/login", "unknown");
  // Dış adrese (Google) yönlendirme: dil ön eki eklenmemeli, bu yüzden Next'in redirect'i kullanılır
  externalRedirect(data.url);
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  await guard("/forgot-password", "reset");
  if (!email) await fail("/forgot-password", "missing_fields");

  const supabase = createClient();
  // Hesap var mı yok mu bilgisini sızdırmamak için sonuç her zaman aynı gösterilir
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
  });
  await go("/forgot-password?info=check_email");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  await requireConfigured("/reset-password");
  if (password.length < 8) await fail("/reset-password", "weak_password");
  if (password !== confirm) await fail("/reset-password", "password_mismatch");

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) await fail("/reset-password", mapSupabaseError(error));

  await go("/dashboard");
}

export async function signOut() {
  if (isSupabaseConfigured()) await createClient().auth.signOut();
  await go("/login");
}
