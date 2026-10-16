import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { PricingSection } from "@/components/marketing/pricing-section";

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "Pricing" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function PricingPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations("Pricing");

  return (
    <main>
      <section className="mx-auto max-w-6xl space-y-8 px-4 py-20">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <PricingSection />
      </section>
      <section className="mx-auto max-w-6xl space-y-8 px-4 pb-20">
        <h2 className="text-center text-2xl font-bold">{t("faqTitle")}</h2>
        <Faq />
      </section>
      <FinalCta />
    </main>
  );
}
