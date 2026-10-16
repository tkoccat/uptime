import { safeEqual } from "../crypto";

/** ADMIN_EMAIL: tek e-posta veya virgülle ayrılmış liste. */
export function adminEmails(raw = process.env.ADMIN_EMAIL): string[] {
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string, raw = process.env.ADMIN_EMAIL): boolean {
  const target = email.trim().toLowerCase();
  // Sabit sürede karşılaştırma: liste elemanlarının hiçbiri erken çıkışla sızdırılmaz
  return adminEmails(raw).reduce((found, e) => safeEqual(e, target) || found, false);
}
