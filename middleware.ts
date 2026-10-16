import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  // Önce dil yönlendirmesi, sonra Supabase oturum yenileme ve rota koruması
  const response = intlMiddleware(request);
  return updateSession(request, response);
}

export const config = {
  // API, auth callback, Next iç dosyaları ve uzantılı statik dosyalar hariç
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};
