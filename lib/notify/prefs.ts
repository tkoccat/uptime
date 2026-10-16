import { PREF_KEY, type EmailTemplate } from "../email/render";

// Kullanıcı tercihleri: anahtar -> false ise o tür e-posta gönderilmez (varsayılan: açık)
export const EMAIL_PREF_KEYS = ["monitor_down", "monitor_up", "billing", "trial", "limits"] as const;
export type EmailPrefKey = (typeof EMAIL_PREF_KEYS)[number];

export function shouldSendEmail(prefs: unknown, template: EmailTemplate): boolean {
  const key = PREF_KEY[template];
  if (!key) return true; // kapatılamayan e-postalar (hoş geldin, iptal)
  const value = (prefs as Record<string, unknown> | null)?.[key];
  return value !== false;
}
