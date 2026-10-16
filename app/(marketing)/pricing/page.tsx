import type { Metadata } from "next";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { PricingTable } from "@/components/marketing/pricing-table";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, low-priced uptime monitoring plans. Start free, upgrade when you grow.",
};

export default function PricingPage() {
  return (
    <main>
      <section className="mx-auto max-w-6xl space-y-8 px-4 py-20">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-bold">Pricing</h1>
          <p className="text-muted-foreground">Start free. Upgrade when you need faster checks and more monitors.</p>
        </div>
        <PricingTable />
      </section>
      <section className="mx-auto max-w-6xl space-y-8 px-4 pb-20">
        <h2 className="text-center text-2xl font-bold">Questions about pricing</h2>
        <Faq />
      </section>
      <FinalCta />
    </main>
  );
}
