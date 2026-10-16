import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { safeNextPath } from "@/lib/auth/messages";

// E-posta doğrulama, şifre sıfırlama ve Google OAuth dönüş noktası
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!code) return NextResponse.redirect(`${origin}/login?error=callback_failed`);

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=callback_failed`);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    // İlk girişte SaaS veritabanında kullanıcı kaydı oluşturulur
    // TODO(adım 11): yeni kullanıcıya hoş geldin e-postası gönder
    await prisma.user.upsert({
      where: { supabaseId: user.id },
      update: {},
      create: {
        supabaseId: user.id,
        email: user.email,
        name: (user.user_metadata?.full_name as string | undefined) ?? null,
      },
    });
  }

  return NextResponse.redirect(`${origin}${next}`);
}
