import { describe, expect, it } from "vitest";
import { daysUntil, parseRdapExpiry, registrableDomain } from "./expiry";

describe("registrableDomain", () => {
  it("alt alan adlarını kök alan adına indirger", () => {
    expect(registrableDomain("www.example.com")).toBe("example.com");
    expect(registrableDomain("a.b.shop.example.io")).toBe("example.io");
    expect(registrableDomain("EXAMPLE.com.")).toBe("example.com");
  });

  it("iki parçalı son ekleri tanır", () => {
    expect(registrableDomain("api.example.co.uk")).toBe("example.co.uk");
    expect(registrableDomain("www.firma.com.tr")).toBe("firma.com.tr");
    expect(registrableDomain("firma.com.tr")).toBe("firma.com.tr");
  });

  it("IP adresi, tek etiket ve geçersiz karakterler için null döner", () => {
    expect(registrableDomain("93.184.216.34")).toBeNull();
    expect(registrableDomain("localhost")).toBeNull();
    expect(registrableDomain("exa mple.com")).toBeNull();
    expect(registrableDomain("a/b.com")).toBeNull();
  });
});

describe("parseRdapExpiry", () => {
  it("expiration olayını okur, diğerlerini ve bozuk veriyi yok sayar", () => {
    const json = { events: [{ eventAction: "registration", eventDate: "2010-01-01T00:00:00Z" }, { eventAction: "expiration", eventDate: "2026-12-19T00:00:00Z" }] };
    expect(parseRdapExpiry(json)?.toISOString()).toBe("2026-12-19T00:00:00.000Z");
    expect(parseRdapExpiry({ events: [{ eventAction: "expiration", eventDate: "nope" }] })).toBeNull();
    expect(parseRdapExpiry({})).toBeNull();
    expect(parseRdapExpiry(null)).toBeNull();
  });
});

describe("daysUntil", () => {
  it("kalan günü yukarı yuvarlar, geçmiş için negatif döner", () => {
    const now = Date.UTC(2026, 9, 16, 12);
    expect(daysUntil(new Date(Date.UTC(2026, 9, 17, 0)), now)).toBe(1);
    expect(daysUntil(new Date(Date.UTC(2026, 11, 1, 12)), now)).toBe(46);
    expect(daysUntil(new Date(Date.UTC(2026, 9, 10, 12)), now)).toBeLessThan(0);
  });
});
