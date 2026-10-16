import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FinalCta } from "@/components/marketing/final-cta";
import { routing } from "@/i18n/routing";
import { comparisonSlugs, type ComparisonSlug } from "@/lib/marketing/content";

type Params = { locale: string; slug: string };

function isSlug(value: string): value is ComparisonSlug {
  return (comparisonSlugs as readonly string[]).includes(value);
}

// Tüm dil ve karşılaştırma kombinasyonları build sırasında statik üretilir
export function generateStaticParams(): Params[] {
  return routing.locales.flatMap((locale) => comparisonSlugs.map((slug) => ({ locale, slug })));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  if (!isSlug(params.slug)) return {};
  const t = await getTranslations({ locale: params.locale, namespace: "Compare.items" });
  return { title: t(`${params.slug}.headline`), description: t(`${params.slug}.intro`) };
}

type Row = { label: string; us: string; them: string };

export default async function AlternativePage({ params: { locale, slug } }: { params: Params }) {
  setRequestLocale(locale);
  if (!isSlug(slug)) notFound();

  const t = await getTranslations("Compare");
  const k = `items.${slug}` as const;
  const name = t(`${k}.name`);
  const rows = t.raw(`${k}.rows`) as Row[];
  const theyGood = t.raw(`${k}.theyGood`) as string[];
  const weGood = t.raw(`${k}.weGood`) as string[];

  return (
    <main>
      <article className="mx-auto max-w-4xl space-y-10 px-4 py-20">
        <header className="space-y-3">
          <h1 className="text-4xl font-bold text-balance">{t(`${k}.headline`)}</h1>
          <p className="text-lg text-muted-foreground">{t(`${k}.intro`)}</p>
        </header>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="p-3" scope="col" />
                <th className="p-3" scope="col">
                  {t("us")}
                </th>
                <th className="p-3" scope="col">
                  {name}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.label}>
                  <th className="p-3 font-medium" scope="row">
                    {r.label}
                  </th>
                  <td className="p-3">{r.us}</td>
                  <td className="p-3">{r.them}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <section className="space-y-2">
            <h2 className="text-xl font-semibold">{t("strongThey", { name })}</h2>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {theyGood.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
          <section className="space-y-2">
            <h2 className="text-xl font-semibold">{t("strongUs")}</h2>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {weGood.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
        </div>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">{t("whichTitle")}</h2>
          <p>
            <strong>{t("chooseThemLabel", { name })}</strong> {t(`${k}.chooseThem`)}
          </p>
          <p>
            <strong>{t("chooseUsLabel")}</strong> {t(`${k}.chooseUs`)}
          </p>
        </section>

        <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
      </article>
      <FinalCta />
    </main>
  );
}
