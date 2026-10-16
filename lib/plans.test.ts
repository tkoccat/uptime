import { describe, expect, it } from "vitest";
import { PlanLimitError } from "./errors";
import {
  PLAN_LIMITS,
  assertApiAllowed,
  assertCustomDomainAllowed,
  assertIntervalAllowed,
  assertMonitorQuota,
  assertStatusPageQuota,
} from "./plans";

describe("plan limitleri", () => {
  it("planlardaki monitör ve aralık değerleri şartnameyle uyumlu", () => {
    expect(PLAN_LIMITS.FREE).toMatchObject({ monitors: 5, minInterval: 180 });
    expect(PLAN_LIMITS.PRO).toMatchObject({ monitors: 50, minInterval: 60 });
    expect(PLAN_LIMITS.BUSINESS).toMatchObject({ monitors: 200, minInterval: 30 });
  });

  it("Free kullanıcı 5. monitörden sonra sınırı aşar (6. eklenemez)", () => {
    expect(() => assertMonitorQuota("FREE", 4)).not.toThrow();
    expect(() => assertMonitorQuota("FREE", 5)).toThrow(PlanLimitError);
  });

  it("limit hatası hangi limitin aşıldığını belirtir", () => {
    try {
      assertMonitorQuota("PRO", 50);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(PlanLimitError);
      expect((err as PlanLimitError).limit).toBe("monitors");
      expect((err as PlanLimitError).status).toBe(402);
    }
  });

  it("kontrol aralığı plan alt sınırının altına inemez", () => {
    expect(() => assertIntervalAllowed("FREE", 60)).toThrow(PlanLimitError);
    expect(() => assertIntervalAllowed("FREE", 180)).not.toThrow();
    expect(() => assertIntervalAllowed("PRO", 60)).not.toThrow();
    expect(() => assertIntervalAllowed("PRO", 30)).toThrow(PlanLimitError);
    expect(() => assertIntervalAllowed("BUSINESS", 30)).not.toThrow();
  });

  it("özel alan adı ve API yalnızca ücretli planlarda", () => {
    expect(() => assertCustomDomainAllowed("FREE")).toThrow(PlanLimitError);
    expect(() => assertCustomDomainAllowed("PRO")).not.toThrow();
    expect(() => assertApiAllowed("FREE")).toThrow(PlanLimitError);
    expect(() => assertApiAllowed("BUSINESS")).not.toThrow();
  });

  it("durum sayfası kotası plana göre uygulanır", () => {
    expect(() => assertStatusPageQuota("FREE", 1)).toThrow(PlanLimitError);
    expect(() => assertStatusPageQuota("PRO", 4)).not.toThrow();
  });
});
