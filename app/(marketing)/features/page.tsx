import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinalCta } from "@/components/marketing/final-cta";
import { features } from "@/lib/marketing/content";

export const metadata: Metadata = {
  title: "Features",
  description: "Alerts, status pages, an API and webhooks, powered by the open-source Uptime Kuma engine.",
};

export default function FeaturesPage() {
  return (
    <main>
      <section className="mx-auto max-w-6xl space-y-8 px-4 py-20">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-bold">Features</h1>
          <p className="text-muted-foreground">Everything you need to know when something breaks.</p>
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
