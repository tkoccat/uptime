import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FinalCta } from "@/components/marketing/final-cta";
import { comparisons } from "@/lib/marketing/content";

type Params = { slug: string };

// Dört karşılaştırma sayfası da build sırasında statik üretilir
export function generateStaticParams(): Params[] {
  return comparisons.map((c) => ({ slug: c.slug }));
}

export const dynamicParams = false;

export function generateMetadata({ params }: { params: Params }): Metadata {
  const c = comparisons.find((x) => x.slug === params.slug);
  return c ? { title: c.headline, description: c.intro } : {};
}

export default function AlternativePage({ params }: { params: Params }) {
  const c = comparisons.find((x) => x.slug === params.slug);
  if (!c) notFound();

  return (
    <main>
      <article className="mx-auto max-w-4xl space-y-10 px-4 py-20">
        <header className="space-y-3">
          <h1 className="text-4xl font-bold text-balance">{c.headline}</h1>
          <p className="text-lg text-muted-foreground">{c.intro}</p>
        </header>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="p-3" scope="col" />
                <th className="p-3" scope="col">
                  Us
                </th>
                <th className="p-3" scope="col">
                  {c.name}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {c.rows.map((r) => (
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
            <h2 className="text-xl font-semibold">Where {c.name} is strong</h2>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {c.theyAreGoodAt.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
          <section className="space-y-2">
            <h2 className="text-xl font-semibold">Where we are strong</h2>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {c.weAreGoodAt.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        </div>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Which should you choose?</h2>
          <p>
            <strong>Choose {c.name} if</strong> {c.chooseThem}
          </p>
          <p>
            <strong>Choose us if</strong> {c.chooseUs}
          </p>
        </section>

        <p className="text-xs text-muted-foreground">
          Comparison is based on publicly available information and may change. Please check each provider&apos;s
          website for current details.
        </p>
      </article>
      <FinalCta />
    </main>
  );
}
