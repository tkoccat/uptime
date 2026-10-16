import { beforeEach, describe, expect, it, vi } from "vitest";

const lookup = vi.fn();
vi.mock("node:dns/promises", () => ({ lookup: (...a: unknown[]) => lookup(...a) }));

import { UnsafeTargetError, assertPublicHost, assertPublicUrl, isPrivateAddress } from "./url-guard";

beforeEach(() => {
  // Süslü parantez şart: beforeEach'ten fonksiyon döndürmek onu "temizlik" olarak çalıştırır
  lookup.mockReset();
});

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // bulut metadata
    "0.0.0.0",
    "100.64.0.1",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:10.0.0.1",
  ])("%s özel/rezerve sayılır", (ip) => expect(isPrivateAddress(ip)).toBe(true));

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "93.184.216.34", "2606:4700:4700::1111"])(
    "%s herkese açık sayılır",
    (ip) => expect(isPrivateAddress(ip)).toBe(false)
  );

  it("tanınmayan biçim güvenli tarafta engellenir", () => expect(isPrivateAddress("not-an-ip")).toBe(true));
});

describe("assertPublicHost", () => {
  it("localhost ve iç ağ uzantılarını reddeder", async () => {
    for (const h of ["localhost", "db.internal", "printer.local", "x.localhost", "nas.lan"]) {
      await expect(assertPublicHost(h)).rejects.toBeInstanceOf(UnsafeTargetError);
    }
    expect(lookup).not.toHaveBeenCalled();
  });

  it("özel IP'ye çözülen alan adını reddeder (SSRF)", async () => {
    lookup.mockResolvedValue([{ address: "10.0.0.5" }]);
    await expect(assertPublicHost("evil.example.com")).rejects.toBeInstanceOf(UnsafeTargetError);
  });

  it("birden fazla adresten biri özelse reddeder", async () => {
    lookup.mockResolvedValue([{ address: "93.184.216.34" }, { address: "127.0.0.1" }]);
    await expect(assertPublicHost("mixed.example.com")).rejects.toBeInstanceOf(UnsafeTargetError);
  });

  it("herkese açık adrese çözülen alan adını kabul eder", async () => {
    lookup.mockResolvedValue([{ address: "93.184.216.34" }]);
    await expect(assertPublicHost("example.com")).resolves.toBeUndefined();
  });

  it("çözümlenemeyen alan adını reddeder", async () => {
    lookup.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(assertPublicHost("nope.invalid")).rejects.toBeInstanceOf(UnsafeTargetError);
  });

  it("IP literali DNS'e sorulmadan değerlendirilir", async () => {
    await expect(assertPublicHost("8.8.8.8")).resolves.toBeUndefined();
    await expect(assertPublicHost("192.168.0.1")).rejects.toBeInstanceOf(UnsafeTargetError);
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe("assertPublicUrl", () => {
  it("http/https dışındaki şemaları reddeder", async () => {
    for (const u of ["file:///etc/passwd", "ftp://example.com", "gopher://x", "javascript:alert(1)"]) {
      await expect(assertPublicUrl(u)).rejects.toBeInstanceOf(UnsafeTargetError);
    }
  });

  it("kimlik bilgisi içeren URL'yi reddeder", async () => {
    await expect(assertPublicUrl("https://user:pass@8.8.8.8/")).rejects.toBeInstanceOf(UnsafeTargetError);
  });

  it("metadata ve iç adresleri reddeder", async () => {
    await expect(assertPublicUrl("http://169.254.169.254/latest/meta-data")).rejects.toBeInstanceOf(UnsafeTargetError);
    await expect(assertPublicUrl("http://localhost:3000")).rejects.toBeInstanceOf(UnsafeTargetError);
  });

  it("geçerli herkese açık URL'yi döndürür", async () => {
    lookup.mockResolvedValue([{ address: "93.184.216.34" }]);
    const url = await assertPublicUrl("https://example.com/health");
    expect(url.hostname).toBe("example.com");
  });
});
