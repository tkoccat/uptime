import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, monitorOptionsSchema, parseStatusList, parseTags, readOptions } from "./monitor-options";

describe("monitör seçenekleri", () => {
  it("boş girdi varsayılanlarla tamamlanır", () => {
    expect(DEFAULT_OPTIONS).toMatchObject({ method: "GET", retries: 1, acceptedStatus: ["200-299"], followRedirects: true, ignoreTls: false });
  });

  it("eski/bozuk kayıt varsayılana düşer, kısmi kayıt tamamlanır", () => {
    expect(readOptions(null)).toEqual(DEFAULT_OPTIONS);
    expect(readOptions({ retries: "abc" })).toEqual(DEFAULT_OPTIONS);
    expect(readOptions({ retries: 3 })).toMatchObject({ retries: 3, method: "GET" });
  });

  it("sınır dışı değerleri ve geçersiz durum kodlarını reddeder", () => {
    expect(monitorOptionsSchema.safeParse({ retries: 11 }).success).toBe(false);
    expect(monitorOptionsSchema.safeParse({ acceptedStatus: ["20x"] }).success).toBe(false);
    expect(monitorOptionsSchema.safeParse({ acceptedStatus: ["200-299", "301"] }).success).toBe(true);
    expect(monitorOptionsSchema.safeParse({ method: "TRACE" }).success).toBe(false);
  });

  it("başlıklar yalnızca JSON nesnesi olabilir", () => {
    expect(monitorOptionsSchema.safeParse({ headers: '{"X-Key":"1"}' }).success).toBe(true);
    expect(monitorOptionsSchema.safeParse({ headers: "[1]" }).success).toBe(false);
    expect(monitorOptionsSchema.safeParse({ headers: "not json" }).success).toBe(false);
  });

  it("durum kodu ve etiket metinlerini ayrıştırır", () => {
    expect(parseStatusList("200-299, 301 404")).toEqual(["200-299", "301", "404"]);
    expect(parseTags("Prod, API server,prod, <x>")).toEqual(["prod", "api-server"]);
    expect(parseTags(Array.from({ length: 15 }, (_, i) => `t${i}`).join(","))).toHaveLength(10);
  });
});
