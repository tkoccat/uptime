import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "Home" });
  return { title: t("faqTitle") };
}

export default async function FaqPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const t = await getTranslations("Home");

  return (
    <main>
      <section className="mx-auto max-w-6xl space-y-8 px-4 py-20">
        <h1 className="text-center text-4xl font-bold">{t("faqTitle")}</h1>
        <Faq />
      </section>
      <FinalCta />
    </main>
  );
}
