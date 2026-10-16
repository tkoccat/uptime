import { defineRouting } from "next-intl/routing";

// Varsayılan dil İngilizce ön eksiz (/), diğerleri /de /fr /tr
export const routing = defineRouting({
  locales: ["en", "de", "fr", "tr"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (routing.locales as readonly string[]).includes(value);
}
