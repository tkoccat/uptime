"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

// Dil adları kendi dillerinde gösterilir
const NAMES: Record<Locale, string> = { en: "English", de: "Deutsch", fr: "Français", tr: "Türkçe" };

// persist: seçilen dili hesaba da kaydeder (panelde e-postalar da bu dilde gelsin)
export function LanguageSwitcher({ persist }: { persist?: (locale: string) => Promise<void> }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("Nav");

  return (
    <select
      aria-label={t("language")}
      value={locale}
      onChange={async (e) => {
        const next = e.target.value as Locale;
        await persist?.(next).catch(() => undefined); // kayıt başarısız olsa da dil değişir
        router.replace(pathname, { locale: next });
      }}
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
