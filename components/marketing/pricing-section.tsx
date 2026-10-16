import { getTranslations } from "next-intl/server";
import { getPlanConfigs, PLAN_ORDER, yearlyDiscountPct, type PlanConfigData } from "@/lib/plan-config";
import { PricingTable, type PricingPlanView } from "./pricing-table";

type T = Awaited<ReturnType<typeof getTranslations>>;

// Özellik maddeleri plan limitlerinden otomatik üretilir: admin limiti değiştirince metin de güncellenir
function featuresOf(cfg: PlanConfigData, t: T, extras: string[]): string[] {
  const out: string[] = [t("feat.monitors", { n: cfg.monitors })];
  out.push(
    cfg.minInterval < 60 || cfg.minInterval % 60 !== 0
      ? t("feat.checkSeconds", { n: cfg.minInterval })
      : t("feat.checkMinutes", { n: cfg.minInterval / 60 })
  );
  out.push(t("feat.statusPages", { n: cfg.statusPages }));
  if (cfg.customDomain) out.push(t("feat.customDomain"));
  if (cfg.api) out.push(t("feat.api"));
  if (cfg.trialDays > 0) out.push(t("feat.trial", { n: cfg.trialDays }));
  return [...out, ...extras];
}

/** Fiyat tablosu: planlar, fiyatlar ve özellikler admin panelindeki ayarlardan okunur. */
export async function PricingSection() {
  const t = await getTranslations("Pricing");
  const configs = await getPlanConfigs();

  const plans: PricingPlanView[] = PLAN_ORDER.filter((p) => configs[p].isActive).map((p) => {
    const cfg = configs[p];
    const id = p.toLowerCase() as PricingPlanView["id"];
    return {
      id,
      name: t(`plans.${id}.name`),
      tagline: t(`plans.${id}.tagline`),
      cta: t(`plans.${id}.cta`),
      highlight: cfg.highlight,
      monthly: cfg.priceMonthly,
      yearly: cfg.priceYearly,
      currency: "GBP",
      features: featuresOf(cfg, t, t.raw(`plans.${id}.extras`) as string[]),
    };
  });

  // Yıllık indirim etiketi: ücretli planlar arasındaki en yüksek indirim
  const discount = Math.max(0, ...plans.filter((p) => p.monthly > 0).map((p) => yearlyDiscountPct(p.monthly, p.yearly)));
  return <PricingTable plans={plans} yearlyDiscount={discount} />;
}
