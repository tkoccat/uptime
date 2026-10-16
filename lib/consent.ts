// Çerez onayı yardımcıları (yalnızca tarayıcıda çalışır).
// Analitik/reklam betikleri (Adım 15) yüklenmeden önce hasAnalyticsConsent() kontrol etmelidir.

export type Consent = "accepted" | "rejected" | null;

const COOKIE = "cookie_consent";
export const CONSENT_EVENT = "cookie-consent-changed";

export function getConsent(): Consent {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=(accepted|rejected)`));
  return (match?.[1] as Consent) ?? null;
}

export function setConsent(value: "accepted" | "rejected") {
  // 6 ay geçerli; SameSite=Lax, yalnızca tercih bilgisini tutar
  const maxAge = 60 * 60 * 24 * 180;
  document.cookie = `${COOKIE}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax${
    location.protocol === "https:" ? "; Secure" : ""
  }`;
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function clearConsent() {
  document.cookie = `${COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function hasAnalyticsConsent(): boolean {
  return getConsent() === "accepted";
}
