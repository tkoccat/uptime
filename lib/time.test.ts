import { describe, expect, it } from "vitest";
import { zonedToUtc } from "./time";

describe("zonedToUtc", () => {
  it("UTC ve sabit farklı dilimleri doğru çevirir", () => {
    expect(zonedToUtc("2026-10-16T10:30", "UTC").toISOString()).toBe("2026-10-16T10:30:00.000Z");
    expect(zonedToUtc("2026-10-16T10:30", "Europe/Istanbul").toISOString()).toBe("2026-10-16T07:30:00.000Z"); // UTC+3
  });

  it("yaz saatini hesaba katar (Londra: Ocak UTC, Temmuz UTC+1)", () => {
    expect(zonedToUtc("2026-01-15T12:00", "Europe/London").toISOString()).toBe("2026-01-15T12:00:00.000Z");
    expect(zonedToUtc("2026-07-15T12:00", "Europe/London").toISOString()).toBe("2026-07-15T11:00:00.000Z");
  });

  it("geçersiz metin Invalid Date döner", () => {
    expect(Number.isNaN(zonedToUtc("yarın", "UTC").getTime())).toBe(true);
    expect(Number.isNaN(zonedToUtc("", "UTC").getTime())).toBe(true);
  });
});
