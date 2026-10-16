import { getRequestConfig } from "next-intl/server";
import { isLocale, routing } from "./routing";
import { loadMessages } from "./messages";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : routing.defaultLocale;

  return { locale, messages: await loadMessages(locale) };
});
