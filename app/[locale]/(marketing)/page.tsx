import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { HeroPreview } from "@/components/marketing/hero-preview";
import { HowItWorks, Integrations, UseCases } from "@/components/marketing/home-sections";
import { PricingSection } from "@/components/marketing/pricing-section";
import { Link } from "@/i18n/navigation";
import type { FeatureItem } from "@/lib/marketing/content";

export default async function HomePage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const tf = await getTranslations("Features");

  const trust = t.raw("trust") as string[];
  const problemSolution = t.raw("problemSolution") as { problem: string; solution: string }[];
  const features = tf.raw("items") as FeatureItem[];

  return (
    <main>
      {/* 1. Hero: metin + ürün önizlemesi */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-2 lg:py-28">
        <div className="space-y-6 text-center lg:text-left">
          <h1 className="text-4xl font-bold tracking-tight text-balance md:text-5xl lg:text-6xl">{t("heroTitle")}</h1>
          <p className="text-lg text-muted-foreground text-balance">{t("heroSub")}</p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
            <Button asChild size="lg">
              <Link href="/register">{t("heroCta")}</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/docs">{t("heroDocs")} →</Link>
            </Button>
          </div>
        </div>
        <HeroPreview />
      </section>

      {/* 2. Güven bandı (uydurma logo/yorum yok, yalnızca doğrulanabilir maddeler) */}
      <section className="border-y bg-secondary/50">
        <ul className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-8 gap-y-2 px-4 py-6 text-sm text-muted-foreground">
          {trust.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span aria-hidden className="text-primary">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* 3. Nasıl çalışır */}
      <HowItWorks />

      {/* 4. Ne izlenir */}
      <UseCases />

      {/* 5. Problem / çözüm */}
      <section className="mx-auto max-w-6xl space-y-8 px-4 py-20">
        <h2 className="text-center text-3xl font-bold text-balance">{t("problemTitle")}</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {problemSolution.map((item) => (
            <Card key={item.problem}>
              <CardHeader>
                <CardTitle className="text-base text-muted-foreground">{item.problem}</CardTitle>
              </CardHeader>
              <CardContent className="font-medium">{item.solution}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 6. Özellikler */}
      <section className="bg-secondary/50">
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-20">
          <h2 className="text-center text-3xl font-bold">{t("featuresTitle")}</h2>
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
        </div>
      </section>

      {/* 7. Entegrasyonlar */}
      <Integrations />

      {/* 8. Fiyatlandırma */}
      <section className="bg-secondary/50">
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-20">
          <h2 className="text-center text-3xl font-bold">{t("pricingTitle")}</h2>
          <PricingSection />
        </div>
      </section>

      {/* 9. SSS */}
      <section className="mx-auto max-w-6xl space-y-8 px-4 py-20">
        <h2 className="text-center text-3xl font-bold">{t("faqTitle")}</h2>
        <Faq />
      </section>

      {/* 10. Son CTA */}
      <FinalCta />
    </main>
  );
}
