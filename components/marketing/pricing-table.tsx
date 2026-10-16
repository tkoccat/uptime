"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { planPrices } from "@/lib/marketing/content";

// Aylık/yıllık geçişi olan fiyat tablosu (yıllıkta yaklaşık %20 indirim)
export function PricingTable() {
  const t = useTranslations("Pricing");
  const [yearly, setYearly] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center gap-2" role="group" aria-label={t("billingPeriod")}>
        <Button variant={yearly ? "outline" : "default"} size="sm" onClick={() => setYearly(false)} aria-pressed={!yearly}>
          {t("monthly")}
        </Button>
        <Button variant={yearly ? "default" : "outline"} size="sm" onClick={() => setYearly(true)} aria-pressed={yearly}>
          {t("yearly")} <span className="ml-1 text-xs opacity-80">{t("save")}</span>
        </Button>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {planPrices.map((plan) => (
          <Card key={plan.id} className={plan.highlight ? "border-primary shadow-lg" : undefined}>
            <CardHeader>
              <CardTitle>{t(`plans.${plan.id}.name`)}</CardTitle>
              <CardDescription>{t(`plans.${plan.id}.tagline`)}</CardDescription>
              <p className="pt-2">
                <span className="text-4xl font-bold">£{yearly ? plan.yearly : plan.monthly}</span>
                <span className="text-muted-foreground">
                  {" "}
                  {plan.monthly === 0 ? t("forever") : yearly ? t("perYear") : t("perMonth")}
                </span>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                {(t.raw(`plans.${plan.id}.features`) as string[]).map((f) => (
                  <li key={f} className="flex gap-2">
                    <span aria-hidden className="text-primary">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild className="w-full" variant={plan.highlight ? "default" : "outline"}>
                <Link href={`/register?plan=${plan.id}&billing=${yearly ? "yearly" : "monthly"}`}>
                  {t(`plans.${plan.id}.cta`)}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">{t("vat")}</p>
    </div>
  );
}
