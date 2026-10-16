import { getTranslations, setRequestLocale } from "next-intl/server";
import { Callout, docMetadata, DocTitle, H2, rich, Table, UL } from "@/components/docs/doc";

export const generateMetadata = ({ params: { locale } }: { params: { locale: string } }) => docMetadata(locale, "monitors");

export default async function MonitorsDoc({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations("Docs.monitors");

  const row = (k: "http" | "keyword" | "ping" | "port" | "dns" | "heartbeat") => [t(`${k}.name`), t.rich(`${k}.what`, rich), t(`${k}.addr`)];

  return (
    <>
      <DocTitle lead={t("lead")}>{t("title")}</DocTitle>

      <H2>{t("hTypes")}</H2>
      <Table head={[t("head.type"), t("head.checks"), t("head.address")]} rows={(["http", "keyword", "ping", "port", "dns", "heartbeat"] as const).map(row)} />

      <Callout tone="warning">{t("warn")}</Callout>

      <H2>{t("hInterval")}</H2>
      <p>{t("interval")}</p>

      <H2>{t("hStates")}</H2>
      <UL items={["up", "down", "paused", "maint"].map((k) => t.rich(k, rich))} />

      <H2>{t("hAdvanced")}</H2>
      <p>{t.rich("advancedIntro", rich)}</p>
      <UL items={["a1", "a2", "a3", "a4", "a5", "a6", "a7"].map((k) => t.rich(k, rich))} />

      <H2>{t("hDetail")}</H2>
      <p>{t("detail")}</p>

      <H2>{t("hMaintenance")}</H2>
      <p>{t.rich("maintenance", rich)}</p>

      <H2>{t("hPause")}</H2>
      <p>{t.rich("pause", rich)}</p>

      <H2>{t("hLimits")}</H2>
      <p>{t.rich("limits", rich)}</p>
    </>
  );
}
