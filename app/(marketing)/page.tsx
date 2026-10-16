import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { PricingTable } from "@/components/marketing/pricing-table";
import { features, problemSolution, trustPoints } from "@/lib/marketing/content";

export default function HomePage() {
  return (
    <main>
      {/* 1. Hero */}
      <section className="mx-auto max-w-4xl space-y-6 px-4 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-balance md:text-6xl">
          Website monitoring for indie hackers and small teams
        </h1>
        <p className="text-lg text-muted-foreground text-balance">
          The power of Uptime Kuma, with the convenience of a SaaS.
        </p>
        <Button asChild size="lg">
          <Link href="/register">Start free — no credit card required</Link>
        </Button>
      </section>

      {/* 2. Güven bandı (uydurma logo/yorum yok, yalnızca doğrulanabilir maddeler) */}
      <section className="border-y bg-secondary/50">
        <ul className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-8 gap-y-2 px-4 py-6 text-sm text-muted-foreground">
          {trustPoints.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      {/* 3. Problem / çözüm */}
      <section className="mx-auto max-w-6xl space-y-8 px-4 py-20">
        <h2 className="text-center text-3xl font-bold text-balance">
          You set up Uptime Kuma. Now we run it for you.
        </h2>
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

      {/* 4. Özellikler */}
      <section className="bg-secondary/50">
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-20">
          <h2 className="text-center text-3xl font-bold">Everything you need to stay online</h2>
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

      {/* 5. Fiyatlandırma */}
      <section className="mx-auto max-w-6xl space-y-8 px-4 py-20">
        <h2 className="text-center text-3xl font-bold">Simple, low-priced plans</h2>
        <PricingTable />
      </section>

      {/* 6. SSS */}
      <section className="mx-auto max-w-6xl space-y-8 px-4 pb-20">
        <h2 className="text-center text-3xl font-bold">Frequently asked questions</h2>
        <Faq />
      </section>

      {/* 7. Son CTA */}
      <FinalCta />
    </main>
  );
}
