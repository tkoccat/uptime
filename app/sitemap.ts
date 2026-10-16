import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { comparisonSlugs } from "@/lib/marketing/content";

const base = () => (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

// Dört dilde çevrilmiş sayfalar
const TRANSLATED = ["", "/features", "/pricing", "/faq", ...comparisonSlugs.map((s) => `/alternatives/${s}`)];
// Yalnızca İngilizce sayfalar (dokümanlar, kurumsal ve yasal metinler)
const ENGLISH_ONLY = [
  "/docs",
  "/docs/monitors",
  "/docs/heartbeat",
  "/docs/alerts",
  "/docs/status-pages",
  "/docs/api",
  "/about",
  "/contact",
  "/security",
  "/terms",
  "/privacy",
  "/cookies",
  "/refunds",
  "/dpa",
  "/sub-processors",
];

const url = (locale: string, path: string) =>
  `${base()}${locale === routing.defaultLocale ? "" : `/${locale}`}${path}` || base();

export default function sitemap(): MetadataRoute.Sitemap {
  const translated = TRANSLATED.map((path) => ({
    url: url(routing.defaultLocale, path) || base(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
    // Her sayfanın diğer dil karşılıkları arama motorlarına bildirilir
    alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, url(l, path) || base()])) },
  }));
  const english = ENGLISH_ONLY.map((path) => ({
    url: url(routing.defaultLocale, path),
    changeFrequency: "monthly" as const,
    priority: path.startsWith("/docs") ? 0.6 : 0.4,
  }));
  return [...translated, ...english];
}
