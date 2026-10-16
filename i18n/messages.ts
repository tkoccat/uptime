import type { Locale } from "./routing";

// Çeviri dosyaları alan bazında bölünmüştür: ana metinler, dashboard, dokümanlar ve e-postalar.
// E-postalar istek bağlamı dışında (kuyruk işçisi) da yüklendiği için bu yardımcı ayrı tutulur.
export async function loadMessages(locale: Locale) {
  const [base, dash, docs, email] = await Promise.all([
    import(`../locales/${locale}.json`),
    import(`../locales/dash.${locale}.json`),
    import(`../locales/docs.${locale}.json`),
    import(`../locales/email.${locale}.json`),
  ]);
  return { ...base.default, ...dash.default, ...docs.default, ...email.default };
}
