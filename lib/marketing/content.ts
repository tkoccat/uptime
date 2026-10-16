// Çeviri gerektirmeyen pazarlama verileri (fiyatlar ve karşılaştırma adresleri).
// Metinler locales/*.json içindedir.

export type PlanId = "free" | "pro" | "business";

// Fiyatlar GBP; yıllık fiyat aylığın 12 katının yaklaşık %20 indirimlisidir
export const planPrices: { id: PlanId; monthly: number; yearly: number; highlight?: boolean }[] = [
  { id: "free", monthly: 0, yearly: 0 },
  { id: "pro", monthly: 9, yearly: 86, highlight: true },
  { id: "business", monthly: 29, yearly: 278 },
];

export const comparisonSlugs = ["better-stack", "uptimerobot", "cronitor", "uptime-kuma"] as const;
export type ComparisonSlug = (typeof comparisonSlugs)[number];

export type Faq = { q: string; a: string };
export type FeatureItem = { title: string; body: string };
