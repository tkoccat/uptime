import { headers } from "next/headers";

export type AuthLocale = "en" | "tr";

// Hata kodu -> mesaj. Adım 6'da next-intl'e taşınacak.
const MESSAGES: Record<AuthLocale, Record<string, string>> = {
  en: {
    invalid_credentials: "Invalid email or password.",
    email_not_confirmed: "Please verify your email before signing in.",
    user_already_exists: "An account with this email already exists.",
    weak_password: "Password must be at least 8 characters.",
    password_mismatch: "Passwords do not match.",
    rate_limited: "Too many attempts. Please try again later.",
    missing_fields: "Please fill in all fields.",
    callback_failed: "The link is invalid or has expired.",
    unknown: "Something went wrong. Please try again.",
    check_email: "Check your email to continue.",
    password_updated: "Your password has been updated.",
  },
  tr: {
    invalid_credentials: "E-posta veya şifre hatalı.",
    email_not_confirmed: "Giriş yapmadan önce e-postanızı doğrulayın.",
    user_already_exists: "Bu e-posta ile zaten bir hesap var.",
    weak_password: "Şifre en az 8 karakter olmalıdır.",
    password_mismatch: "Şifreler eşleşmiyor.",
    rate_limited: "Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.",
    missing_fields: "Lütfen tüm alanları doldurun.",
    callback_failed: "Bağlantı geçersiz veya süresi dolmuş.",
    unknown: "Bir şeyler ters gitti. Lütfen tekrar deneyin.",
    check_email: "Devam etmek için e-postanızı kontrol edin.",
    password_updated: "Şifreniz güncellendi.",
  },
};

// Tarayıcının Accept-Language başlığına göre dil seçer
export function detectLocale(): AuthLocale {
  const header = headers().get("accept-language") ?? "";
  return header.toLowerCase().startsWith("tr") ? "tr" : "en";
}

export function authMessage(code: string | undefined, locale: AuthLocale): string | null {
  if (!code) return null;
  return MESSAGES[locale][code] ?? MESSAGES[locale].unknown;
}

// Supabase hata kodlarını kendi kodlarımıza çevirir
export function mapSupabaseError(error: { code?: string; message?: string; status?: number }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "invalid_credentials";
    case "email_not_confirmed":
      return "email_not_confirmed";
    case "user_already_exists":
    case "email_exists":
      return "user_already_exists";
    case "weak_password":
      return "weak_password";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "rate_limited";
    default:
      return error.status === 429 ? "rate_limited" : "unknown";
  }
}

// Open redirect'i önler: yalnızca site içi yollara izin verilir
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/dashboard";
  }
  return next;
}
