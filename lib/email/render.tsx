import { createTranslator } from "next-intl";
import { render } from "@react-email/render";
import { loadMessages } from "@/i18n/messages";
import { isLocale, routing, type Locale } from "@/i18n/routing";
import { company } from "../company";
import { BasicEmail } from "./templates";

export const EMAIL_TEMPLATES = [
  "verify_email",
  "welcome",
  "monitor_down",
  "monitor_up",
  "payment_succeeded",
  "payment_failed",
  "subscription_canceled",
  "trial_ending",
  "limit_warning",
] as const;
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

// Kullanıcının kapatabileceği e-posta türleri (hoş geldin ve iptal bildirimi her zaman gider)
export const PREF_KEY: Partial<Record<EmailTemplate, string>> = {
  monitor_down: "monitor_down",
  monitor_up: "monitor_up",
  payment_succeeded: "billing",
  payment_failed: "billing",
  trial_ending: "trial",
  limit_warning: "limits",
};

export type RenderedEmail = { subject: string; html: string; text: string };

export async function renderEmail(params: {
  template: EmailTemplate;
  locale: string;
  vars?: Record<string, string | number>;
  ctaPath?: string;
  // Tam adres verilirse ctaPath yerine kullanılır (örn. doğrulama bağlantısı)
  ctaUrl?: string;
}): Promise<RenderedEmail> {
  const locale: Locale = isLocale(params.locale) ? params.locale : routing.defaultLocale;
  const messages = await loadMessages(locale);
  const t = createTranslator({ locale, messages, namespace: "Email" });

  const vars = { product: company.productName, ...(params.vars ?? {}) };
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  const ctaUrl = params.ctaUrl ?? (params.ctaPath ? `${appUrl}${prefix}${params.ctaPath}` : undefined);

  const props = {
    lang: locale,
    heading: t(`${params.template}.heading`, vars),
    body: t(`${params.template}.body`, vars),
    ctaLabel: ctaUrl ? t(`${params.template}.cta`, vars) : undefined,
    ctaUrl,
    footer: t("footer", vars),
  };

  const element = <BasicEmail {...props} />;
  return {
    subject: t(`${params.template}.subject`, vars),
    html: await render(element),
    text: await render(element, { plainText: true }),
  };
}
