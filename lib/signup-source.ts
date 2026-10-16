// Kayıt kaynağı (UTM) çerezi: yalnızca çerez onayı verildiyse istemci tarafında yazılır (bkz. components/tracking).
export const SIGNUP_SOURCE_COOKIE = "signup_source";

export type SignupSource = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
};

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/[^\w.\-: /]/g, "").slice(0, 100) || undefined : undefined);

/** Çerez değerini güvenli biçimde ayrıştırır (kullanıcı girdisi olduğundan her alan temizlenir). */
export function parseSignupSource(raw: string | undefined | null): SignupSource {
  if (!raw) return {};
  try {
    const o = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    return {
      utmSource: clean(o.s),
      utmMedium: clean(o.m),
      utmCampaign: clean(o.c),
      referrer: clean(o.r),
    };
  } catch {
    return {};
  }
}
