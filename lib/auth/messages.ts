// Auth yardımcıları. Kullanıcıya gösterilen metinler locales/*.json içindeki "Auth" bölümündedir.

// Supabase hata kodlarını locales'teki Auth.errors anahtarlarına çevirir
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
