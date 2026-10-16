import { getTranslations } from "next-intl/server";
import { getPlanConfigs, PLAN_ORDER } from "@/lib/plan-config";

type Faq = { q: string; a: string };

/** Plan karşılaştırma tablosu: değerler admin panelindeki plan ayarlarından okunur. */
export async function PricingComparison() {
  const t = await getTranslations("Pricing");
  const configs = await getPlanConfigs();
  const plans = PLAN_ORDER.filter((p) => configs[p].isActive);

  const interval = (s: number) => (s < 60 || s % 60 !== 0 ? t("feat.checkSeconds", { n: s }) : t("feat.checkMinutes", { n: s / 60 }));
  const bool = (v: boolean) => (v ? t("compare.yes") : t("compare.no"));

  const rows: { label: string; values: string[] }[] = [
    { label: t("compare.monitors"), values: plans.map((p) => String(configs[p].monitors)) },
    { label: t("compare.interval"), values: plans.map((p) => interval(configs[p].minInterval)) },
    { label: t("compare.statusPages"), values: plans.map((p) => String(configs[p].statusPages)) },
    { label: t("compare.customDomain"), values: plans.map((p) => bool(configs[p].customDomain)) },
    { label: t("compare.api"), values: plans.map((p) => bool(configs[p].api)) },
    { label: t("compare.trial"), values: plans.map((p) => (configs[p].trialDays > 0 ? t("feat.trial", { n: configs[p].trialDays }) : t("compare.none"))) },
  ];
  const always = [t("compare.heartbeat"), t("compare.channels"), t("compare.badges")];

  return (
    <section className="mx-auto max-w-4xl space-y-4 px-4 pb-20">
      <h2 className="text-center text-2xl font-bold">{t("compareTitle")}</h2>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary">
            <tr>
              <th className="p-3" scope="col">
                {t("compare.feature")}
              </th>
              {plans.map((p) => (
                <th key={p} className="p-3" scope="col">
                  {t(`plans.${p.toLowerCase()}.name`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.label}>
                <th className="p-3 font-medium" scope="row">
                  {r.label}
                </th>
                {r.values.map((v, i) => (
                  <td key={i} className="p-3">
                    {v}
                  </td>
                ))}
              </tr>
            ))}
            {always.map((label) => (
              <tr key={label}>
                <th className="p-3 font-medium" scope="row">
                  {label}
                </th>
                <td className="p-3 text-muted-foreground" colSpan={plans.length}>
                  {t("compare.always")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Faturalama SSS'si: ana SSS'den ayrı, fiyat sayfasına özel. */
export async function PricingFaq() {
  const t = await getTranslations("PricingFaq");
  const tp = await getTranslations("Pricing");
  const items = t.raw("items") as Faq[];

  return (
    <section className="mx-auto max-w-6xl space-y-8 px-4 pb-20">
      <h2 className="text-center text-2xl font-bold">{tp("faqTitle2")}</h2>
      <div className="mx-auto max-w-3xl divide-y rounded-lg border">
        {items.map((item) => (
          <details key={item.q} className="group p-4">
            <summary className="cursor-pointer list-none font-medium marker:hidden">
              <span className="mr-2 text-primary group-open:hidden">+</span>
              <span className="mr-2 hidden text-primary group-open:inline">−</span>
              {item.q}
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
