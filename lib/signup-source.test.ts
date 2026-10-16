import { describe, expect, it } from "vitest";
import { parseSignupSource } from "./signup-source";

const cookie = (o: unknown) => encodeURIComponent(JSON.stringify(o));

describe("parseSignupSource", () => {
  it("geçerli çerezi ayrıştırır", () => {
    expect(parseSignupSource(cookie({ s: "google", m: "cpc", c: "launch", r: "news.ycombinator.com" }))).toEqual({
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "launch",
      referrer: "news.ycombinator.com",
    });
  });

  it("bozuk veya boş çerezde boş nesne döner", () => {
    expect(parseSignupSource(undefined)).toEqual({});
    expect(parseSignupSource("%%%")).toEqual({});
    expect(parseSignupSource(encodeURIComponent("not json"))).toEqual({});
  });

  it("kullanıcı girdisi temizlenir ve uzunluğu sınırlanır (enjeksiyon/şişirme)", () => {
    const r = parseSignupSource(cookie({ s: "<script>alert(1)</script>", c: "a".repeat(500), m: 5 }));
    expect(r.utmSource).toBe("scriptalert1script");
    expect(r.utmCampaign).toHaveLength(100);
    expect(r.utmMedium).toBeUndefined();
  });
});
