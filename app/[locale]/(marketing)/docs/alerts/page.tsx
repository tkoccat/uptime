import { getTranslations, setRequestLocale } from "next-intl/server";
import { Callout, docMetadata, DocTitle, H2, rich, Table } from "@/components/docs/doc";

export const generateMetadata = ({ params: { locale } }: { params: { locale: string } }) => docMetadata(locale, "alerts");

export default async function AlertsDoc({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations("Docs.alerts");

  const channels: [string, "email" | "slack" | "discord" | "telegram" | "teams" | "googleChat" | "ntfy" | "pushover" | "webhook" | "sms"][] = [
    ["Email", "email"],
    ["Slack", "slack"],
    ["Discord", "discord"],
    ["Telegram", "telegram"],
    ["Microsoft Teams", "teams"],
    ["Google Chat", "googleChat"],
    ["ntfy", "ntfy"],
    ["Pushover", "pushover"],
    ["Webhook", "webhook"],
    ["SMS", "sms"],
  ];

  return (
    <>
      <DocTitle lead={t("lead")}>{t("title")}</DocTitle>

      <p>{t.rich("intro", rich)}</p>

      <Table head={[t("head.channel"), t("head.need")]} rows={channels.map(([name, key]) => [name, t(key)])} />

      <H2>{t("hPayload")}</H2>
      <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 text-sm leading-6">
        <code>{`{
  "event": "monitor.down",          // or "monitor.up", "test"
  "title": "My site is down",
  "text": "https://example.com — connection timeout",
  "monitor": { "id": "clx...", "name": "My site", "url": "https://example.com" },
  "time": "2026-10-16T10:00:00.000Z"
}`}</code>
      </pre>

      <Callout tone="warning">{t("warn")}</Callout>

      <H2>{t("hMaint")}</H2>
      <p>{t.rich("maint", rich)}</p>

      <H2>{t("hPrefs")}</H2>
      <p>{t.rich("prefs", rich)}</p>
    </>
  );
}
