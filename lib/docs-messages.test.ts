import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../locales/docs.en.json";
import tr from "../locales/docs.tr.json";
import de from "../locales/docs.de.json";
import fr from "../locales/docs.fr.json";

const keysOf = (o: Record<string, unknown>, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === "object" && v !== null ? keysOf(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`]));

// Çeviri metinlerindeki tüm etiketler: biçimlendirme hatası (ör. kaçış gerektiren kesme işareti) burada yakalanır
const tag = (name: string) => (chunks: unknown) => `[${name}:${Array.isArray(chunks) ? chunks.join("") : String(chunks)}]`;
const tags = Object.fromEntries(["b", "em", "code", "monitorsLink", "heartbeatLink", "statusLink", "apiLink", "faqLink", "contactLink", "registerLink", "pricingLink"].map((n) => [n, tag(n)]));

const locales = { en, tr, de, fr } as const;

describe("doküman çevirileri", () => {
  const ref = keysOf(en).sort();

  for (const [locale, messages] of Object.entries(locales)) {
    it(`${locale}: anahtarlar İngilizce ile aynı ve her metin hatasız biçimlenir`, () => {
      expect(keysOf(messages).sort()).toEqual(ref);
      const t = createTranslator({ locale, messages: messages as never, namespace: "Docs" });
      for (const key of ref) {
        const out = (t.rich as (k: string, v: object) => unknown)(key, { ...tags, domain: "status.example.com" });
        const text = Array.isArray(out) ? out.join("") : String(out);
        // Kaçak etiket veya işlenmemiş yer tutucu kalmamalı
        expect(text, `${locale}:${key}`).not.toMatch(/<\/?[a-zA-Z]+>|\{domain\}/);
        expect(text.length, `${locale}:${key}`).toBeGreaterThan(0);
      }
    });
  }
});