import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { queueUserEmail } from "@/lib/notify/user-email";
import { safeNextPath } from "@/lib/auth/messages";
import { SIGNUP_SOURCE_COOKIE, parseSignupSource } from "@/lib/signup-source";
import { isLocale, routing, type Locale } from "@/i18n/routing";

// E-posta doğrulama, şifre sıfırlama ve Google OAuth dönüş noktası
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  // Dil önceliği: kayıtta kaydedilen tercih, sonra NEXT_LOCALE çerezi, sonra varsayılan
  const cookieLocale = cookies().get("NEXT_LOCALE")?.value;
  const prefixFor = (l: Locale) => (l === routing.defaultLocale ? "" : `/${l}`);
  const fallbackLocale: Locale = isLocale(cookieLocale) ? cookieLocale : routing.defaultLocale;

  if (!code) return NextResponse.redirect(`${origin}${prefixFor(fallbackLocale)}/login?error=callback_failed`);

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}${prefixFor(fallbackLocale)}/login?error=callback_failed`);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const metaLocale = user?.user_metadata?.locale as string | undefined;
  const locale: Locale = isLocale(metaLocale) ? metaLocale : fallbackLocale;

  // Kayıt kaynağı: önce kayıtta kullanıcı verisine yazılanlar, yoksa (Google girişi) çerez
  const meta = user?.user_metadata ?? {};
  const cookieSrc = parseSignupSource(cookies().get(SIGNUP_SOURCE_COOKIE)?.value);
  const pick = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 100) : undefined);
  const source = {
    utmSource: pick(meta.utm_source) ?? cookieSrc.utmSource,
    utmMedium: pick(meta.utm_medium) ?? cookieSrc.utmMedium,
    utmCampaign: pick(meta.utm_campaign) ?? cookieSrc.utmCampaign,
    referrer: pick(meta.referrer) ?? cookieSrc.referrer,
  };

  if (user?.email) {
    // İlk girişte SaaS veritabanında kullanıcı kaydı oluşturulur (dil tercihi dahil)
    const existing = await prisma.user.findUnique({ where: { supabaseId: user.id }, select: { id: true } });
    const record = await prisma.user.upsert({
      where: { supabaseId: user.id },
      update: {},
      create: {
        supabaseId: user.id,
        email: user.email,
        name: (user.user_metadata?.full_name as string | undefined) ?? null,
        locale,
        ...source,
      },
    });
    // Yalnızca yeni kullanıcıya, kendi dilinde hoş geldin e-postası (şifre sıfırlamada tekrar gitmez)
    if (!existing) await queueUserEmail(record.id, "welcome", {}, "/dashboard");
  }

  return NextResponse.redirect(`${origin}${prefixFor(locale)}${next}`);
}
