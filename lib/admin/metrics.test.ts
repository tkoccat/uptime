import { describe, expect, it } from "vitest";
import { computeChurn, computeMrr, monthlyValue } from "./metrics";

describe("admin metrikleri", () => {
  it("aylık eşdeğer değer: yıllık fiyat 12'ye bölünür (ana birim)", () => {
    expect(monthlyValue("PRO", "monthly")).toBe(9);
    expect(monthlyValue("PRO", "yearly")).toBeCloseTo(86 / 12);
    expect(monthlyValue("BUSINESS", "monthly")).toBe(29);
    expect(monthlyValue("FREE", "monthly")).toBe(0);
  });

  it("MRR aylık ve yıllık abonelikleri toplar", () => {
    const billing = (id: string) => (id.endsWith("_y") ? ("yearly" as const) : ("monthly" as const));
    const mrr = computeMrr(
      [
        { plan: "PRO", stripePriceId: "p_m" },
        { plan: "PRO", stripePriceId: "p_y" },
        { plan: "BUSINESS", stripePriceId: "b_m" },
      ],
      billing
    );
    expect(mrr).toBeCloseTo(9 + 86 / 12 + 29);
  });

  it("abonelik yoksa MRR 0", () => expect(computeMrr([], () => null)).toBe(0));

  it("churn: iptaller / (aktifler + iptaller)", () => {
    expect(computeChurn(90, 10)).toBeCloseTo(10);
    expect(computeChurn(0, 0)).toBeNull();
    expect(computeChurn(0, 5)).toBe(100);
  });
});
