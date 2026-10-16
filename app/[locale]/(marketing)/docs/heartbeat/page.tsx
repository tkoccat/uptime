import { getTranslations, setRequestLocale } from "next-intl/server";
import { baseUrl, Callout, Code, docMetadata, DocTitle, H2, rich, Table, UL } from "@/components/docs/doc";

export const generateMetadata = ({ params: { locale } }: { params: { locale: string } }) => docMetadata(locale, "heartbeat");

export default async function HeartbeatDoc({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations("Docs.heartbeat");
  const url = `${baseUrl()}/api/ping/YOUR_PING_KEY`;

  return (
    <>
      <DocTitle lead={t("lead")}>{t("title")}</DocTitle>

      <H2>{t("hHow")}</H2>
      <ol className="list-decimal space-y-2 pl-6">
        {["h1", "h2", "h3"].map((k) => (
          <li key={k}>{t.rich(k, rich)}</li>
        ))}
      </ol>

      <H2>{t("hUrls")}</H2>
      <Table
        head={[t("urlHead.url"), t("urlHead.meaning")]}
        rows={[
          [<code key="a">{url}</code>, t("okMeaning")],
          [<code key="b">{url}/fail</code>, t("failMeaning")],
        ]}
      />
      <p>{t.rich("methods", rich)}</p>

      <H2>{t("hExamples")}</H2>
      <Code title={t("cronTitle")}>{`0 2 * * *  /usr/local/bin/backup.sh && curl -fsS -m 10 --retry 5 -o /dev/null ${url}`}</Code>
      <Code title={t("shellTitle")}>{`#!/bin/sh
if /usr/local/bin/backup.sh; then
  curl -fsS -m 10 --retry 5 -o /dev/null ${url}
else
  curl -fsS -m 10 --retry 5 -o /dev/null ${url}/fail
fi`}</Code>
      <Code title="systemd service">{`[Service]
ExecStart=/usr/local/bin/backup.sh
ExecStopPost=/bin/sh -c 'if [ "$EXIT_STATUS" = 0 ]; then curl -fsS -m 10 ${url}; else curl -fsS -m 10 ${url}/fail; fi'`}</Code>
      <Code title="GitHub Actions">{`- name: Notify monitoring
  if: success()
  run: curl -fsS -m 10 --retry 5 "\${{ secrets.HEARTBEAT_URL }}"`}</Code>
      <Code title="Python">{`import requests

requests.get("${url}", timeout=10)`}</Code>
      <Code title="Node.js">{`await fetch("${url}", { signal: AbortSignal.timeout(10_000) });`}</Code>

      <H2>{t("hChoose")}</H2>
      <UL items={[t("c1"), t("c2"), t("c3")]} />

      <Callout>{t.rich("callout", rich)}</Callout>

      <H2>{t("hNot")}</H2>
      <p>{t("not")}</p>
    </>
  );
}
