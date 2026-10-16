import { describe, expect, it } from "vitest";
import { applyOverrides, CONTENT_KEYS, fromEditorText, getByPath, setByPath, toEditorText } from "./content-keys";

describe("içerik düzenleyici dönüşümleri", () => {
  it("metin: kırpılır, boş değer null döner (varsayılana dön)", () => {
    expect(fromEditorText("text", "  Merhaba  ")).toBe("Merhaba");
    expect(fromEditorText("text", "   ")).toBeNull();
    expect((fromEditorText("text", "x".repeat(2000)) as string).length).toBe(600);
  });

  it("satır listesi: boş satırlar atılır", () => {
    expect(fromEditorText("lines", "a\n\n b \n")).toEqual(["a", "b"]);
    expect(toEditorText("lines", ["a", "b"])).toBe("a\nb");
  });

  it("SSS: bloklar boş satırla ayrılır, ilk satır soru, kalanı cevap; gidiş dönüş korunur", () => {
    const items = [
      { q: "What is it?", a: "A monitor." },
      { q: "Cost?", a: "Free to start." },
    ];
    const text = toEditorText("faq", items);
    expect(text).toBe("What is it?\nA monitor.\n\nCost?\nFree to start.");
    expect(fromEditorText("faq", text)).toEqual(items);
  });

  it("SSS: cevabı olmayan blok atılır, çok satırlı cevap birleştirilir", () => {
    expect(fromEditorText("faq", "Only question\n\nQ2\nline one\nline two")).toEqual([{ q: "Q2", a: "line one line two" }]);
  });

  it("kartlar: başlık ve açıklama ayrıştırılır (CRLF dahil)", () => {
    expect(fromEditorText("cards", "Alerts\r\nGet notified.\r\n\r\nAPI\r\nAutomate.")).toEqual([
      { title: "Alerts", body: "Get notified." },
      { title: "API", body: "Automate." },
    ]);
  });

  it("yol okuma ve yazma: girdi değişmez, ara nesneler oluşturulur", () => {
    const base = { Home: { heroTitle: "A" } };
    expect(getByPath(base, "Home.heroTitle")).toBe("A");
    expect(getByPath(base, "Home.nope.deeper")).toBeUndefined();
    const next = setByPath(base, "Pricing.plans.pro.tagline", "B");
    expect(getByPath(next, "Pricing.plans.pro.tagline")).toBe("B");
    expect(getByPath(base, "Pricing")).toBeUndefined();
  });

  it("yalnızca izin verilen anahtarlar uygulanır (rastgele yol yazılamaz)", () => {
    const messages = { Home: { heroTitle: "Default" }, Auth: { errors: { unknown: "x" } } };
    const out = applyOverrides(messages, {
      "Home.heroTitle": "Custom",
      "Auth.errors.unknown": "hacked", // listede yok
      "__proto__.polluted": "yes",
    });
    expect(out.Home.heroTitle).toBe("Custom");
    expect(out.Auth.errors.unknown).toBe("x");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("anahtar listesi benzersiz ve geçerli türde", () => {
    const keys = CONTENT_KEYS.map((k) => k.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of CONTENT_KEYS) expect(["text", "lines", "faq", "cards"]).toContain(k.kind);
  });
});
