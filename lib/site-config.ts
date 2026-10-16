import { ttlCache } from "./cache";
import baseCompany from "./company.json";
import { prisma } from "./prisma";

// Site geneli ayarlar (admin panelinden düzenlenir). Veritabanı okunamazsa varsayılanlarla devam edilir.

export type Company = typeof baseCompany;

export type Announcement = {
  enabled: boolean;
  tone: "info" | "sale" | "warning";
  // Dil -> metin. Boş dil için İngilizce gösterilir.
  text: Record<string, string>;
  link: string;
};

export const DEFAULT_ANNOUNCEMENT: Announcement = { enabled: false, tone: "info", text: {}, link: "" };

const settings = ttlCache(30_000, async (): Promise<Record<string, unknown>> => {
  try {
    const rows = await prisma.siteSetting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch (err) {
    console.warn("[site-config] ayarlar okunamadı, varsayılanlar kullanılıyor:", (err as Error).message?.slice(0, 120));
    return {};
  }
});

const contentCaches = new Map<string, ReturnType<typeof ttlCache<Record<string, unknown>>>>();

function contentCache(locale: string) {
  let c = contentCaches.get(locale);
  if (!c) {
    c = ttlCache(30_000, async () => {
      try {
        const rows = await prisma.siteContent.findMany({ where: { locale } });
        return Object.fromEntries(rows.map((r) => [r.key, r.value]));
      } catch {
        return {};
      }
    });
    contentCaches.set(locale, c);
  }
  return c;
}

export function invalidateSiteConfig() {
  settings.invalidate();
  for (const c of contentCaches.values()) c.invalidate();
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const all = await settings.get();
  return key in all ? ({ ...(typeof fallback === "object" ? (fallback as object) : {}), ...(all[key] as object) } as T) : fallback;
}

/** Şirket bilgileri: company.json üzerine admin panelindeki değişiklikler. */
export async function getCompany(): Promise<Company> {
  const all = await settings.get();
  const o = (all.company ?? {}) as Partial<Company>;
  const clean = Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === "string" && v.trim()));
  return { ...baseCompany, ...clean } as Company;
}

export async function getAnnouncement(): Promise<Announcement> {
  const all = await settings.get();
  return { ...DEFAULT_ANNOUNCEMENT, ...((all.announcement ?? {}) as Partial<Announcement>) };
}

/** Yeni kayıtlar açık mı? (varsayılan: açık) */
export async function signupsEnabled(): Promise<boolean> {
  const all = await settings.get();
  return (all.signups as { enabled?: boolean } | undefined)?.enabled !== false;
}

export function getContentOverrides(locale: string): Promise<Record<string, unknown>> {
  return contentCache(locale).get();
}
