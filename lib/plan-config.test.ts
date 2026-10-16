import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ planConfig: { findMany: vi.fn() } }));
vi.mock("./prisma", () => ({ prisma: db }));

import { DEFAULT_PLAN_CONFIGS, formatMoney, getPlanConfigs, invalidatePlanConfigs, mergeConfig, yearlyDiscountPct } from "./plan-config";
import { getLimits } from "./plans";

beforeEach(() => {
  vi.clearAllMocks();
  invalidatePlanConfigs();
});

describe("plan ayarları", () => {
  it("kayıt yoksa kod içindeki varsayılanlar geçerlidir", async () => {
    db.planConfig.findMany.mockResolvedValue([]);
    const c = await getPlanConfigs();
    expect(c.PRO).toMatchObject({ priceMonthly: 900, priceYearly: 8600, monitors: 50, trialDays: 14 });
    expect(c.FREE.priceMonthly).toBe(0);
  });

  it("veritabanı değeri varsayılanın üzerine yazar", async () => {
    db.planConfig.findMany.mockResolvedValue([{ ...DEFAULT_PLAN_CONFIGS.PRO, priceMonthly: 1500, monitors: 75 }]);
    const c = await getPlanConfigs();
    expect(c.PRO).toMatchObject({ priceMonthly: 1500, monitors: 75 });
    expect(c.BUSINESS.priceMonthly).toBe(2900); // dokunulmayan plan varsayılan kalır
  });

  it("veritabanı okunamazsa varsayılanlarla devam eder (site çökmez)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    db.planConfig.findMany.mockRejectedValue(new Error("db down"));
    const c = await getPlanConfigs();
    expect(c.PRO.monitors).toBe(50);
  });

  it("sonuç kısa süre önbelleğe alınır, invalidate ile yenilenir", async () => {
    db.planConfig.findMany.mockResolvedValue([]);
    await getPlanConfigs();
    await getPlanConfigs();
    expect(db.planConfig.findMany).toHaveBeenCalledTimes(1);
    invalidatePlanConfigs();
    await getPlanConfigs();
    expect(db.planConfig.findMany).toHaveBeenCalledTimes(2);
  });

  it("getLimits admin'in değiştirdiği limiti yansıtır", async () => {
    db.planConfig.findMany.mockResolvedValue([{ ...DEFAULT_PLAN_CONFIGS.FREE, monitors: 10, minInterval: 120 }]);
    expect(await getLimits("FREE")).toMatchObject({ monitors: 10, minInterval: 120 });
  });

  it("mergeConfig satır yoksa varsayılanı döndürür", () => {
    expect(mergeConfig("PRO", undefined)).toBe(DEFAULT_PLAN_CONFIGS.PRO);
  });
});

describe("para biçimi ve indirim", () => {
  it("küçük birimi para birimine çevirir (tam sayıda kuruş gösterilmez)", () => {
    expect(formatMoney(900, "GBP", "en-GB")).toBe("£9");
    expect(formatMoney(950, "GBP", "en-GB")).toBe("£9.50");
    expect(formatMoney(2900, "EUR", "de-DE")).toContain("29");
  });

  it("yıllık indirim yüzdesi 12 aylık ödemeye göre hesaplanır", () => {
    expect(yearlyDiscountPct(900, 8600)).toBe(20);
    expect(yearlyDiscountPct(2900, 27800)).toBe(20);
    expect(yearlyDiscountPct(1000, 12000)).toBe(0);
    expect(yearlyDiscountPct(1000, 13000)).toBe(0); // negatif indirim 0'a sabitlenir
    expect(yearlyDiscountPct(0, 0)).toBe(0);
  });
});
