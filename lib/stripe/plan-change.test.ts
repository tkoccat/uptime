import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  monitor: { findMany: vi.fn(), updateMany: vi.fn() },
  planConfig: { findMany: vi.fn() },
}));
vi.mock("../prisma", () => ({ prisma: db }));

const adapter = vi.hoisted(() => ({ setMonitorActive: vi.fn() }));
vi.mock("../uptime-kuma", () => ({ getAdapter: () => adapter }));

import { invalidatePlanConfigs } from "../plan-config";
import { applyPlan } from "./plan-change";

const monitors = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, uptimeKumaMonitorId: 100 + i }));

beforeEach(() => {
  vi.clearAllMocks();
  invalidatePlanConfigs();
  db.planConfig.findMany.mockResolvedValue([]);
  db.user.update.mockResolvedValue({});
  db.monitor.updateMany.mockResolvedValue({});
  adapter.setMonitorActive.mockResolvedValue(undefined);
});

describe("applyPlan", () => {
  it("planı günceller; limit aşılmıyorsa monitör duraklatılmaz", async () => {
    db.user.findUnique.mockResolvedValue({ planLocked: false, plan: "FREE" });
    db.monitor.findMany.mockResolvedValue(monitors(3));
    const res = await applyPlan("u1", "PRO");
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { plan: "PRO" } });
    expect(res).toMatchObject({ paused: 0, skipped: false });
    expect(adapter.setMonitorActive).not.toHaveBeenCalled();
  });

  it("Free'ye düşünce limiti aşan en yeni monitörler duraklatılır, en eskiler kalır", async () => {
    db.user.findUnique.mockResolvedValue({ planLocked: false, plan: "PRO" });
    db.monitor.findMany.mockResolvedValue(monitors(8)); // en eskiden yeniye sıralı
    const res = await applyPlan("u1", "FREE");
    expect(res.paused).toBe(3);
    expect(adapter.setMonitorActive.mock.calls.map((c) => c[1])).toEqual([105, 106, 107]);
    expect(db.monitor.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["m5", "m6", "m7"] } }, data: { isActive: false } });
  });

  it("admin planı kilitlediyse Stripe kaynaklı değişiklik uygulanmaz", async () => {
    db.user.findUnique.mockResolvedValue({ planLocked: true, plan: "BUSINESS" });
    const res = await applyPlan("u1", "FREE");
    expect(res).toMatchObject({ skipped: true });
    expect(db.user.update).not.toHaveBeenCalled();
    expect(adapter.setMonitorActive).not.toHaveBeenCalled();
  });

  it("force ile (admin işlemi) kilit aşılır", async () => {
    db.user.findUnique.mockResolvedValue({ planLocked: true, plan: "BUSINESS" });
    db.monitor.findMany.mockResolvedValue(monitors(1));
    await applyPlan("u1", "PRO", { force: true });
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { plan: "PRO" } });
  });

  it("admin'in değiştirdiği limit uygulanır (Free 2 monitör)", async () => {
    db.planConfig.findMany.mockResolvedValue([
      { plan: "FREE", priceMonthly: 0, priceYearly: 0, eurMonthly: null, eurYearly: null, usdMonthly: null, usdYearly: null, monitors: 2, minInterval: 180, statusPages: 1, customDomain: false, api: false, trialDays: 0, highlight: false, isActive: true, stripeProductId: null, stripePriceMonthly: null, stripePriceYearly: null, stripePriceHistory: [] },
    ]);
    db.user.findUnique.mockResolvedValue({ planLocked: false, plan: "PRO" });
    db.monitor.findMany.mockResolvedValue(monitors(4));
    const res = await applyPlan("u1", "FREE");
    expect(res.paused).toBe(2);
  });
});
