import { getTranslations, setRequestLocale } from "next-intl/server";
import { Callout, docMetadata, DocTitle, H2, rich, UL } from "@/components/docs/doc";

export const generateMetadata = ({ params: { locale } }: { params: { locale: string } }) => docMetadata(locale, "home");

export default async function DocsHome({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations("Docs.home");

  return (
    <>
      <DocTitle lead={t("lead")}>{t("title")}</DocTitle>

      <H2>{t("hWhat")}</H2>
      <UL items={[t.rich("w1", rich), t.rich("w2", rich), t.rich("w3", rich)]} />

      <H2>{t("hFirst")}</H2>
      <ol className="list-decimal space-y-2 pl-6">
        {["s1", "s2", "s3", "s4"].map((k) => (
          <li key={k}>{t.rich(k, rich)}</li>
        ))}
      </ol>

      <Callout>{t("callout")}</Callout>

      <H2>{t("hAutomate")}</H2>
      <p>{t.rich("automate", rich)}</p>

      <H2>{t("hHelp")}</H2>
      <p>{t.rich("help", rich)}</p>
    </>
  );
}
