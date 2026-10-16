import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { resolveHostRoute, type HostConfig } from "@/lib/status-page/host";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

function hostConfig(): HostConfig {
  let appHost = "localhost";
  try {
    appHost = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").hostname;
  } catch {
    /* geçersiz URL: varsayılan kalır */
  }
  return {
    appHost,
    statusBaseDomain: (process.env.NEXT_PUBLIC_STATUS_BASE_DOMAIN ?? "").toLowerCase(),
    extraAppHosts: (process.env.APP_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean),
  };
}

export async function middleware(request: NextRequest) {
  // 1) Durum sayfası alan adları: <slug>.siten.com ve özel alan adları kök yolda sayfaya yeniden yazılır
  const route = resolveHostRoute(request.headers.get("host"), hostConfig());
  if (route.kind !== "app") {
    if (request.nextUrl.pathname !== "/") return new NextResponse("Not found", { status: 404 });
    const target = route.kind === "slug" ? `/status/${route.slug}` : `/status/custom-domain/${encodeURIComponent(route.host)}`;
    return NextResponse.rewrite(new URL(target, request.url));
  }

  // 2) Uygulama: dil yönlendirmesi, ardından Supabase oturum yenileme ve rota koruması
  const response = intlMiddleware(request);
  return updateSession(request, response);
}

export const config = {
  // API, auth callback, durum sayfası yolları, Next iç dosyaları ve uzantılı statik dosyalar hariç.
  // (Durum sayfası alan adlarının kök yolu "/" yine de buradan geçer ve yukarıda yeniden yazılır.)
  matcher: ["/((?!api|auth|status|_next|_vercel|.*\\..*).*)"],
};
