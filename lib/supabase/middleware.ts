import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

// Giriş gerektiren yollar (dil ön eki çıkarıldıktan sonra)
const PROTECTED_PREFIXES = ["/dashboard", "/settings", "/billing", "/admin"];

// Yolun başındaki dil ön ekini ayırır: "/tr/dashboard" -> { locale: "tr", path: "/dashboard" }
function splitLocale(pathname: string) {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue;
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return { prefix: `/${locale}`, path: pathname.slice(locale.length + 1) || "/" };
    }
  }
  return { prefix: "", path: pathname };
}

// Her istekte oturumu yeniler ve korumalı yolları kontrol eder.
// `response`: next-intl middleware'inin ürettiği yanıt; çerezler onun üzerine yazılır.
export async function updateSession(request: NextRequest, response: NextResponse) {
  // next-intl bir yönlendirme döndürdüyse (örn. /en -> /) önce onu uygula
  if (response.headers.has("location")) return response;

  const { prefix, path } = splitLocale(request.nextUrl.pathname);
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

  // Supabase henüz yapılandırılmadıysa (ilk kurulum) site çökmesin: pazarlama sayfaları açılır,
  // korumalı sayfalar girişe yönlendirilir.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    if (!isProtected) return response;
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}/login`;
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, httpOnly: true })
          );
        },
      },
    }
  );

  // getUser() token'ı Supabase'e doğrulatır; getSession() cookie'ye körü körüne güvenir
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}/login`;
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }

  return response;
}
