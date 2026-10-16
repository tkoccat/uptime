import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinalCta } from "@/components/marketing/final-cta";
import type { FeatureItem } from "@/lib/marketing/content";

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "Features" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function FeaturesPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations("Features");
  const features = t.raw("items") as FeatureItem[];

  return (
    <main>
      <section className="mx-auto max-w-6xl space-y-8 px-4 py-20">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <CardTitle className="text-lg">{f.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{f.body}</CardContent>
            </Card>
          ))}
        </div>
      </section>
      <FinalCta />
    </main>
  );
}
