// Admin panelinden düzenlenebilen site metinleri. Her anahtar locales/*.json içindeki bir yola karşılık gelir;
// veritabanında bir değer varsa JSON dosyasındaki varsayılanın yerine geçer, silinirse varsayılana dönülür.

export type ContentKind = "text" | "lines" | "faq" | "cards";

export type ContentKey = { key: string; label: string; group: string; kind: ContentKind; help?: string };

export const CONTENT_KEYS: ContentKey[] = [
  { key: "Home.heroTitle", label: "Hero title", group: "Home page", kind: "text" },
  { key: "Home.heroSub", label: "Hero subtitle", group: "Home page", kind: "text" },
  { key: "Home.heroCta", label: "Hero button", group: "Home page", kind: "text" },
  { key: "Home.trust", label: "Trust bar items", group: "Home page", kind: "lines", help: "One item per line." },
  { key: "Home.problemTitle", label: "Problem/solution title", group: "Home page", kind: "text" },
  { key: "Home.featuresTitle", label: "Features section title", group: "Home page", kind: "text" },
  { key: "Home.pricingTitle", label: "Pricing section title", group: "Home page", kind: "text" },
  { key: "Home.faqTitle", label: "FAQ section title", group: "Home page", kind: "text" },
  { key: "Features.items", label: "Feature cards", group: "Features", kind: "cards", help: "Blank line between cards. First line is the title, the rest is the description." },
  { key: "Faq.items", label: "FAQ", group: "FAQ", kind: "faq", help: "Blank line between questions. First line is the question, the rest is the answer." },
  { key: "Pricing.title", label: "Pricing page title", group: "Pricing", kind: "text" },
  { key: "Pricing.subtitle", label: "Pricing page subtitle", group: "Pricing", kind: "text" },
  { key: "Pricing.vat", label: "Pricing footnote", group: "Pricing", kind: "text" },
  { key: "Pricing.plans.free.tagline", label: "Free plan tagline", group: "Pricing", kind: "text" },
  { key: "Pricing.plans.pro.tagline", label: "Pro plan tagline", group: "Pricing", kind: "text" },
  { key: "Pricing.plans.business.tagline", label: "Business plan tagline", group: "Pricing", kind: "text" },
  { key: "Pricing.plans.free.extras", label: "Free plan extra bullets", group: "Pricing", kind: "lines", help: "Shown after the automatic limits. One per line." },
  { key: "Pricing.plans.pro.extras", label: "Pro plan extra bullets", group: "Pricing", kind: "lines", help: "Shown after the automatic limits. One per line." },
  { key: "Pricing.plans.business.extras", label: "Business plan extra bullets", group: "Pricing", kind: "lines", help: "Shown after the automatic limits. One per line." },
  { key: "FinalCta.title", label: "Closing call-to-action title", group: "Closing", kind: "text" },
  { key: "FinalCta.body", label: "Closing call-to-action text", group: "Closing", kind: "text" },
  { key: "FinalCta.cta", label: "Closing button", group: "Closing", kind: "text" },
  { key: "Meta.title", label: "Browser title (SEO)", group: "SEO", kind: "text" },
  { key: "Meta.description", label: "Meta description (SEO)", group: "SEO", kind: "text" },
];

export const CONTENT_KEY_SET = new Set(CONTENT_KEYS.map((k) => k.key));

type Json = string | string[] | { q: string; a: string }[] | { title: string; body: string }[];

const blocks = (s: string) =>
  s
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

/** Düzenleyicide gösterilecek metin biçimine çevirir. */
export function toEditorText(kind: ContentKind, value: unknown): string {
  if (value == null) return "";
  switch (kind) {
    case "text":
      return String(value);
    case "lines":
      return (value as string[]).join("\n");
    case "faq":
      return (value as { q: string; a: string }[]).map((x) => `${x.q}\n${x.a}`).join("\n\n");
    case "cards":
      return (value as { title: string; body: string }[]).map((x) => `${x.title}\n${x.body}`).join("\n\n");
  }
}

/** Düzenleyici metnini saklanacak JSON değerine çevirir. Boş metin = null (varsayılana dön). */
export function fromEditorText(kind: ContentKind, text: string): Json | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  switch (kind) {
    case "text":
      return trimmed.slice(0, 600);
    case "lines":
      return trimmed
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 20);
    case "faq":
      return blocks(trimmed)
        .map((b) => {
          const [q, ...rest] = b.split("\n");
          return { q: q.trim(), a: rest.join(" ").trim() };
        })
        .filter((x) => x.q && x.a)
        .slice(0, 30);
    case "cards":
      return blocks(trimmed)
        .map((b) => {
          const [title, ...rest] = b.split("\n");
          return { title: title.trim(), body: rest.join(" ").trim() };
        })
        .filter((x) => x.title && x.body)
        .slice(0, 12);
  }
}

export function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

/** Üst düzey iç içe nesnede yola değer yazar (girdiyi değiştirmez, kopya döndürür). */
export function setByPath<T extends Record<string, unknown>>(obj: T, path: string, value: unknown): T {
  const keys = path.split(".");
  const clone = structuredClone(obj) as Record<string, unknown>;
  let cur = clone;
  for (const k of keys.slice(0, -1)) {
    if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = value;
  return clone as T;
}

/** Çeviri dosyalarının üzerine admin düzenlemelerini uygular (yalnızca izin verilen anahtarlar). */
export function applyOverrides<T extends Record<string, unknown>>(messages: T, overrides: Record<string, unknown>): T {
  let out = messages;
  for (const [key, value] of Object.entries(overrides)) {
    if (!CONTENT_KEY_SET.has(key) || value == null) continue;
    out = setByPath(out, key, value);
  }
  return out;
}
