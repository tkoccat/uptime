import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { safeNextPath } from "@/lib/auth/messages";
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

  if (user?.email) {
    // İlk girişte SaaS veritabanında kullanıcı kaydı oluşturulur (dil tercihi dahil)
    // TODO(adım 11): yeni kullanıcıya hoş geldin e-postası gönder (kullanıcının dilinde)
    await prisma.user.upsert({
      where: { supabaseId: user.id },
      update: {},
      create: {
        supabaseId: user.id,
        email: user.email,
        name: (user.user_metadata?.full_name as string | undefined) ?? null,
        locale,
      },
    });
  }

  return NextResponse.redirect(`${origin}${prefixFor(locale)}${next}`);
}
