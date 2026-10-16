import { getTranslations, setRequestLocale } from "next-intl/server";
import { baseUrl, Callout, Code, docMetadata, DocTitle, H2, rich, Table } from "@/components/docs/doc";

export const generateMetadata = ({ params: { locale } }: { params: { locale: string } }) => docMetadata(locale, "api");

export default async function ApiDoc({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations("Docs.api");
  const base = baseUrl();

  return (
    <>
      <DocTitle lead={t("lead")}>{t("title")}</DocTitle>

      <H2>{t("hAuth")}</H2>
      <p>{t.rich("auth", rich)}</p>
      <Code>{`Authorization: Bearer upk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</Code>
      <Callout tone="warning">{t("authWarn")}</Callout>

      <H2>{t("hBase")}</H2>
      <p>
        <code>{base}/api/v1</code>. {t.rich("base", rich)}
      </p>

      <H2>{t("hEndpoints")}</H2>
      <Table
        head={[t("epHead.method"), t("epHead.path"), t("epHead.desc")]}
        rows={[
          ["GET", "/monitors", t("epList")],
          ["POST", "/monitors", t("epCreate")],
          ["GET", "/monitors/{id}", t("epGet")],
          ["DELETE", "/monitors/{id}", t("epDelete")],
        ]}
      />

      <H2>{t("hCreate")}</H2>
      <Code title={t("request")}>{`curl -X POST ${base}/api/v1/monitors \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Production site",
    "type": "HTTP",
    "url": "https://example.com",
    "interval": 60
  }'`}</Code>
      <Table
        head={[t("fieldHead.field"), t("fieldHead.type"), t("fieldHead.notes")]}
        rows={[
          ["name", "string", t("fName")],
          ["type", "string", t("fType")],
          ["url", "string", t("fUrl")],
          ["interval", "integer", t("fInterval")],
          ["keyword", "string", t("fKeyword")],
          ["grace", "integer", t("fGrace")],
        ]}
      />
      <Code title={t("response201")}>{`{
  "data": {
    "id": "clx9k2m0a0001",
    "name": "Production site",
    "url": "https://example.com",
    "type": "HTTP",
    "interval": 60,
    "active": true,
    "createdAt": "2026-10-16T10:00:00.000Z"
  }
}`}</Code>
      <p>{t.rich("pingUrlNote", rich)}</p>

      <H2>{t("hStatus")}</H2>
      <Code title={t("response")}>{`{
  "data": {
    "id": "clx9k2m0a0001",
    "status": "up",          // up | down | pending | maintenance
    "time": "2026-10-16T10:05:00.000Z",
    "ping": 123,             // response time in ms, when available
    "message": "200 - OK"
  }
}`}</Code>

      <H2>{t("hErrors")}</H2>
      <Code>{`{ "error": { "code": "plan_limit", "message": "Your FREE plan allows up to 5 monitors. Upgrade to add more." } }`}</Code>
      <Table
        head={[t("errHead.status"), t("errHead.code"), t("errHead.meaning")]}
        rows={[
          ["400", "validation", t("e400")],
          ["401", "unauthorized", t("e401")],
          ["402", "plan_limit", t("e402")],
          ["403", "suspended", t("e403")],
          ["404", "not_found", t("e404")],
          ["429", "rate_limited", t("e429")],
        ]}
      />

      <H2>{t("hRate")}</H2>
      <p>{t("rate")}</p>
    </>
  );
}
