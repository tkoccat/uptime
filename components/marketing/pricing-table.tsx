"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { plans } from "@/lib/marketing/content";

// Aylık/yıllık geçişi olan fiyat tablosu (yıllıkta yaklaşık %20 indirim)
export function PricingTable() {
  const [yearly, setYearly] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center gap-2" role="group" aria-label="Billing period">
        <Button variant={yearly ? "outline" : "default"} size="sm" onClick={() => setYearly(false)} aria-pressed={!yearly}>
          Monthly
        </Button>
        <Button variant={yearly ? "default" : "outline"} size="sm" onClick={() => setYearly(true)} aria-pressed={yearly}>
          Yearly <span className="ml-1 text-xs opacity-80">save 20%</span>
        </Button>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className={plan.highlight ? "border-primary shadow-lg" : undefined}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.tagline}</CardDescription>
              <p className="pt-2">
                <span className="text-4xl font-bold">£{yearly ? plan.yearly : plan.monthly}</span>
                <span className="text-muted-foreground">
                  {plan.monthly === 0 ? " forever" : yearly ? " /year" : " /month"}
                </span>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span aria-hidden className="text-primary">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild className="w-full" variant={plan.highlight ? "default" : "outline"}>
                <Link href={`/register?plan=${plan.id}&billing=${yearly ? "yearly" : "monthly"}`}>{plan.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">Prices in GBP. VAT is added where applicable.</p>
    </div>
  );
}
