import { afterEach, describe, expect, it, vi } from "vitest";
import { decrypt, encrypt, safeEqual, sha256, signToken, verifyToken } from "./crypto";

describe("crypto", () => {
  it("şifrele/çöz gidiş dönüşü çalışır ve her seferinde farklı çıktı üretir", () => {
    const a = encrypt("https://hooks.slack.com/services/secret");
    const b = encrypt("https://hooks.slack.com/services/secret");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("https://hooks.slack.com/services/secret");
  });

  it("şifreli veri kurcalanırsa çözme başarısız olur", () => {
    const [iv, tag, data] = encrypt("secret").split(".");
    const tampered = [iv, tag, Buffer.from("xxxxxxxx").toString("base64")].join(".");
    expect(() => decrypt(tampered)).toThrow();
    expect(() => decrypt(`${iv}.${tag}`)).toThrow();
    expect(data).toBeTruthy();
  });

  it("sha256 ve safeEqual", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(safeEqual("a", "a")).toBe(true);
    expect(safeEqual("a", "b")).toBe(false);
    expect(safeEqual("a", "aa")).toBe(false);
  });

  describe("imzalı jetonlar", () => {
    afterEach(() => vi.useRealTimers());

    it("geçerli jeton payload'ı döndürür", () => {
      expect(verifyToken(signToken("channel-1"))).toBe("channel-1");
    });

    it("kurcalanmış jeton reddedilir", () => {
      const [body, sig] = signToken("channel-1").split(".");
      const forged = Buffer.from(JSON.stringify({ p: "channel-2", e: 9_999_999_999 })).toString("base64url");
      expect(verifyToken(`${forged}.${sig}`)).toBeNull();
      expect(verifyToken(`${body}.bozuk`)).toBeNull();
      expect(verifyToken("çöp")).toBeNull();
    });

    it("süresi dolan jeton reddedilir", () => {
      vi.useFakeTimers();
      const token = signToken("c", 60);
      vi.advanceTimersByTime(61_000);
      expect(verifyToken(token)).toBeNull();
    });
  });
});
