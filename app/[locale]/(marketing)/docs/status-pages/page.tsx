import { getTranslations, setRequestLocale } from "next-intl/server";
import { baseUrl, Callout, Code, docMetadata, DocTitle, H2, rich, statusDomain, UL } from "@/components/docs/doc";

export const generateMetadata = ({ params: { locale } }: { params: { locale: string } }) => docMetadata(locale, "statusPages");

export default async function StatusPagesDoc({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations("Docs.statusPages");
  const values = { ...rich, domain: statusDomain() };

  return (
    <>
      <DocTitle lead={t("lead")}>{t("title")}</DocTitle>

      <H2>{t("hCreate")}</H2>
      <p>{t.rich("create", values)}</p>
      <UL items={[t("c1"), t("c2"), t("c3")]} />

      <H2>{t("hDomain")}</H2>
      <p>{t.rich("domain", rich)}</p>
      <ol className="list-decimal space-y-1 pl-6">
        {["d1", "d2", "d3"].map((k) => (
          <li key={k}>{t.rich(k, values)}</li>
        ))}
      </ol>
      <Callout tone="warning">{t.rich("domainWarn", rich)}</Callout>

      <H2>{t("hBadges")}</H2>
      <p>{t.rich("badges", rich)}</p>
      <Code title={t("overall")}>{`${baseUrl()}/api/badge/status/your-address.svg`}</Code>
      <Code title={t("uptime")}>{`${baseUrl()}/api/badge/uptime/your-address.svg`}</Code>
      <Code title="Markdown">{`![status](${baseUrl()}/api/badge/status/your-address.svg)`}</Code>
      <p>{t("badgesNote")}</p>
    </>
  );
}
