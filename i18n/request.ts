import { getRequestConfig } from "next-intl/server";
import { applyOverrides } from "@/lib/admin/content-keys";
import { getContentOverrides } from "@/lib/site-config";
import { isLocale, routing } from "./routing";
import { loadMessages } from "./messages";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : routing.defaultLocale;

  // Dosyadaki metinlerin üzerine admin panelinde yapılan düzenlemeler uygulanır
  const messages = await loadMessages(locale);
  const overrides = await getContentOverrides(locale);
  return { locale, messages: applyOverrides(messages, overrides) };
});
