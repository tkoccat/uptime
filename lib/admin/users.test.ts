import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  monitor: { findMany: vi.fn(), updateMany: vi.fn() },
  subscription: { findFirst: vi.fn(), update: vi.fn() },
  planConfig: { findMany: vi.fn() },
}));
vi.mock("../prisma", () => ({ prisma: db }));

const adapter = vi.hoisted(() => ({ setMonitorActive: vi.fn() }));
vi.mock("../uptime-kuma", () => ({ getAdapter: () => adapter }));

const stripe = vi.hoisted(() => ({ subscriptions: { update: vi.fn() } }));
vi.mock("../stripe/client", () => ({ getStripe: () => stripe }));

const deleteAccount = vi.hoisted(() => vi.fn());
vi.mock("../account", () => ({ deleteAccount }));

import { AppError, ValidationError } from "../errors";
import { invalidatePlanConfigs } from "../plan-config";
import { deleteUserByAdmin, extendTrial, listUsers, setSuspended, setUserPlan, unlockUserPlan } from "./users";

const userRow = (over = {}) => ({ id: "u1", email: "user@x.com", plan: "PRO", planLocked: false, suspendedAt: null, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  invalidatePlanConfigs();
  process.env.ADMIN_EMAIL = "boss@x.com";
  db.planConfig.findMany.mockResolvedValue([]);
  db.user.findUnique.mockResolvedValue(userRow());
  db.user.update.mockResolvedValue({});
  db.monitor.findMany.mockResolvedValue([]);
  db.monitor.updateMany.mockResolvedValue({});
  adapter.setMonitorActive.mockResolvedValue(undefined);
});

describe("kullanıcı yönetimi", () => {
  it("plan elle verilir ve kilitlenir; kilit Stripe olaylarını engeller", async () => {
    await setUserPlan("u1", "BUSINESS", true);
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { planLocked: true } });
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { plan: "BUSINESS" } });
  });

  it("kilit açılınca plan aktif aboneliğe göre, yoksa Free olur", async () => {
    db.subscription.findFirst.mockResolvedValue({ plan: "PRO" });
    await unlockUserPlan("u1");
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { plan: "PRO" } });

    db.subscription.findFirst.mockResolvedValue(null);
    await unlockUserPlan("u1");
    expect(db.user.update).toHaveBeenLastCalledWith({ where: { id: "u1" }, data: { plan: "FREE" } });
  });

  it("askıya alma monitörleri Kuma'da ve DB'de duraklatır", async () => {
    db.monitor.findMany.mockResolvedValue([{ id: "m1", uptimeKumaMonitorId: 11 }, { id: "m2", uptimeKumaMonitorId: 12 }]);
    await setSuspended("u1", true);
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { suspendedAt: expect.any(Date) } });
    expect(adapter.setMonitorActive).toHaveBeenCalledWith("u1", 11, false);
    expect(adapter.setMonitorActive).toHaveBeenCalledWith("u1", 12, false);
    expect(db.monitor.updateMany).toHaveBeenCalledWith({ where: { userId: "u1" }, data: { isActive: false } });
  });

  it("askıdan çıkarma monitörleri yeniden açar", async () => {
    db.monitor.findMany.mockResolvedValue([{ id: "m1", uptimeKumaMonitorId: 11 }]);
    await setSuspended("u1", false);
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { suspendedAt: null } });
    expect(adapter.setMonitorActive).toHaveBeenCalledWith("u1", 11, true);
  });

  it("yönetici hesabı askıya alınamaz ve silinemez", async () => {
    db.user.findUnique.mockResolvedValue(userRow({ email: "boss@x.com" }));
    await expect(setSuspended("u1", true)).rejects.toBeInstanceOf(ValidationError);
    await expect(deleteUserByAdmin("u1", "boss@x.com")).rejects.toBeInstanceOf(ValidationError);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("silme için e-posta doğrulaması gerekir", async () => {
    await expect(deleteUserByAdmin("u1", "wrong@x.com")).rejects.toBeInstanceOf(ValidationError);
    expect(deleteAccount).not.toHaveBeenCalled();
    await expect(deleteUserByAdmin("u1", " USER@x.com ")).resolves.toBe("user@x.com");
    expect(deleteAccount).toHaveBeenCalledWith("u1");
  });

  describe("deneme süresi uzatma", () => {
    it("Stripe ve veritabanında trial_end ileri alınır", async () => {
      const end = new Date(Date.now() + 2 * 86_400_000);
      db.subscription.findFirst.mockResolvedValue({ id: "s1", stripeSubscriptionId: "sub_1", trialEnd: end });
      const next = await extendTrial("u1", 7);
      expect(next.getTime()).toBeCloseTo(end.getTime() + 7 * 86_400_000, -3);
      expect(stripe.subscriptions.update).toHaveBeenCalledWith("sub_1", { trial_end: Math.floor(next.getTime() / 1000), proration_behavior: "none" });
      expect(db.subscription.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { trialEnd: next, trialReminderSentAt: null } });
    });

    it("deneme bitmişse bugünden itibaren uzatılır", async () => {
      db.subscription.findFirst.mockResolvedValue({ id: "s1", stripeSubscriptionId: "sub_1", trialEnd: new Date(Date.now() - 86_400_000) });
      const next = await extendTrial("u1", 3);
      expect(next.getTime()).toBeGreaterThan(Date.now() + 2.9 * 86_400_000);
    });

    it("denemesi olmayan kullanıcıda ve geçersiz gün sayısında hata verir", async () => {
      db.subscription.findFirst.mockResolvedValue(null);
      await expect(extendTrial("u1", 7)).rejects.toBeInstanceOf(AppError);
      await expect(extendTrial("u1", 0)).rejects.toBeInstanceOf(ValidationError);
      await expect(extendTrial("u1", 500)).rejects.toBeInstanceOf(ValidationError);
      expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    });
  });

  it("liste arama e-postayı büyük/küçük harf duyarsız filtreler ve sayfalar", async () => {
    db.user.findMany.mockResolvedValue([]);
    db.user.count.mockResolvedValue(60);
    const res = await listUsers({ q: " Taner ", plan: "PRO", page: 2 });
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: { contains: "Taner", mode: "insensitive" }, plan: "PRO" }, skip: 25, take: 25 })
    );
    expect(res).toMatchObject({ total: 60, page: 2, pages: 3 });
  });
});
