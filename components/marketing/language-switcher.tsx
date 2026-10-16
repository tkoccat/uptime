"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

// Dil adları kendi dillerinde gösterilir
const NAMES: Record<Locale, string> = { en: "English", de: "Deutsch", fr: "Français", tr: "Türkçe" };

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("Nav");

  return (
    <select
      aria-label={t("language")}
      value={locale}
      onChange={(e) => router.replace(pathname, { locale: e.target.value as Locale })}
      className="h-9 rounded-md border bg-background px-2 text-sm"
    >
      {routing.locales.map((l) => (
        <option key={l} value={l}>
          {NAMES[l]}
        </option>
      ))}
    </select>
  );
}
