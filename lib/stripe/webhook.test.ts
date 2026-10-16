import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  stripeEvent: { findUnique: vi.fn(), create: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  subscription: { upsert: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
}));
vi.mock("../prisma", () => ({ prisma: db }));

const applyPlan = vi.hoisted(() => vi.fn());
vi.mock("./plan-change", () => ({ applyPlan }));

const queueUserEmail = vi.hoisted(() => vi.fn());
vi.mock("../notify/user-email", () => ({ queueUserEmail }));

const stripe = vi.hoisted(() => ({
  subscriptions: { retrieve: vi.fn(), cancel: vi.fn() },
}));
vi.mock("./client", () => ({ getStripe: () => stripe }));

import { handleStripeEvent } from "./webhook";

const PRICES = {
  STRIPE_PRICE_ID_PRO_MONTHLY: "price_pro_m",
  STRIPE_PRICE_ID_PRO_YEARLY: "price_pro_y",
  STRIPE_PRICE_ID_BUSINESS_MONTHLY: "price_biz_m",
  STRIPE_PRICE_ID_BUSINESS_YEARLY: "price_biz_y",
};

const event = (type: string, object: unknown, id = "evt_1") => ({ id, type, data: { object } }) as unknown as Stripe.Event;

const subscription = (over: Record<string, unknown> = {}) =>
  ({
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    metadata: { userId: "u1" },
    cancel_at_period_end: false,
    trial_end: null,
    canceled_at: null,
    items: { data: [{ price: { id: "price_pro_m" }, current_period_end: 1_800_000_000 }] },
    ...over,
  }) as unknown as Stripe.Subscription;

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(process.env, PRICES);
  db.stripeEvent.findUnique.mockResolvedValue(null);
  db.stripeEvent.create.mockResolvedValue({});
});

describe("Stripe webhook işleyicisi", () => {
  it("aynı olay ikinci kez gelirse işlenmez (idempotent)", async () => {
    db.stripeEvent.findUnique.mockResolvedValue({ id: "evt_1" });
    expect(await handleStripeEvent(event("customer.subscription.updated", subscription()))).toBe("duplicate");
    expect(db.subscription.upsert).not.toHaveBeenCalled();
    expect(db.stripeEvent.create).not.toHaveBeenCalled();
  });

  it("aktif abonelik kaydedilir ve kullanıcı Pro plana geçer", async () => {
    expect(await handleStripeEvent(event("customer.subscription.created", subscription()))).toBe("processed");
    expect(db.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: "sub_1" },
        create: expect.objectContaining({ userId: "u1", plan: "PRO", status: "ACTIVE", stripePriceId: "price_pro_m" }),
      })
    );
    expect(applyPlan).toHaveBeenCalledWith("u1", "PRO");
    expect(db.stripeEvent.create).toHaveBeenCalledWith({ data: { id: "evt_1", type: "customer.subscription.created" } });
  });

  it("deneme sürecindeki abonelik ücretli özellikleri açar ve deneme bitişini kaydeder", async () => {
    await handleStripeEvent(event("customer.subscription.created", subscription({ status: "trialing", trial_end: 1_700_000_000 })));
    expect(applyPlan).toHaveBeenCalledWith("u1", "PRO");
    expect(db.subscription.upsert.mock.calls[0][0].create).toMatchObject({ status: "TRIALING", trialEnd: new Date(1_700_000_000 * 1000) });
  });

  it("Business fiyatı Business plana eşlenir", async () => {
    await handleStripeEvent(
      event("customer.subscription.updated", subscription({ items: { data: [{ price: { id: "price_biz_y" }, current_period_end: 1_800_000_000 }] } }))
    );
    expect(applyPlan).toHaveBeenCalledWith("u1", "BUSINESS");
  });

  it("ödenmemiş (unpaid) abonelik Free'ye düşürür", async () => {
    await handleStripeEvent(event("customer.subscription.updated", subscription({ status: "unpaid" })));
    expect(applyPlan).toHaveBeenCalledWith("u1", "FREE");
  });

  it("bilinmeyen fiyat hata verir ve olay kaydedilmez (Stripe yeniden dener)", async () => {
    const sub = subscription({ items: { data: [{ price: { id: "price_unknown" }, current_period_end: 1 }] } });
    await expect(handleStripeEvent(event("customer.subscription.updated", sub))).rejects.toThrow(/Bilinmeyen Stripe fiyatı/);
    expect(db.stripeEvent.create).not.toHaveBeenCalled();
    expect(applyPlan).not.toHaveBeenCalled();
  });

  it("sahibi bulunamayan abonelik hata verir", async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(
      handleStripeEvent(event("customer.subscription.updated", subscription({ metadata: {} })))
    ).rejects.toThrow(/sahibi bulunamadı/);
  });

  it("abonelik silinince Free'ye düşer ve iptal e-postası kuyruğa girer", async () => {
    db.subscription.count.mockResolvedValue(0);
    db.user.findUnique.mockResolvedValue({ plan: "PRO" });
    await handleStripeEvent(event("customer.subscription.deleted", subscription({ status: "canceled" })));
    expect(applyPlan).toHaveBeenCalledWith("u1", "FREE");
    expect(queueUserEmail).toHaveBeenCalledWith("u1", "subscription_canceled", { plan: "PRO" }, "/pricing");
  });

  it("başka aktif aboneliği olan kullanıcı silmede Free'ye düşmez", async () => {
    db.subscription.count.mockResolvedValue(1);
    await handleStripeEvent(event("customer.subscription.deleted", subscription({ status: "canceled" })));
    expect(applyPlan).not.toHaveBeenCalled();
  });

  it("başarılı ödeme sayacı sıfırlar ve makbuz e-postası kuyruğa girer", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u1", plan: "PRO" });
    const invoice = { customer: "cus_1", amount_paid: 900, attempt_count: 1 };
    await handleStripeEvent(event("invoice.payment_succeeded", invoice));
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { paymentFailedCount: 0 } });
    expect(queueUserEmail).toHaveBeenCalledWith("u1", "payment_succeeded", { plan: "PRO" }, "/dashboard/billing");
  });

  it("sıfır tutarlı (deneme) fatura için makbuz e-postası gitmez", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u1", plan: "PRO" });
    await handleStripeEvent(event("invoice.payment_succeeded", { customer: "cus_1", amount_paid: 0, attempt_count: 1 }));
    expect(queueUserEmail).not.toHaveBeenCalled();
  });

  it("1. ve 2. başarısız denemede plan korunur, uyarı e-postası gider", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u1", plan: "PRO" });
    await handleStripeEvent(event("invoice.payment_failed", { customer: "cus_1", attempt_count: 2 }));
    expect(queueUserEmail).toHaveBeenCalledWith("u1", "payment_failed", { plan: "PRO", attempt: 2 }, "/dashboard/billing");
    expect(applyPlan).not.toHaveBeenCalled();
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("3. başarısız denemede abonelik iptal edilir ve Free'ye düşürülür", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u1", plan: "PRO" });
    stripe.subscriptions.cancel.mockResolvedValue({});
    const invoice = { customer: "cus_1", attempt_count: 3, parent: { subscription_details: { subscription: "sub_1" } } };
    await handleStripeEvent(event("invoice.payment_failed", invoice));
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith("sub_1");
    expect(applyPlan).toHaveBeenCalledWith("u1", "FREE");
    expect(queueUserEmail).toHaveBeenCalledWith("u1", "subscription_canceled", { plan: "PRO" }, "/pricing");
  });

  it("checkout tamamlanınca müşteri kimliği kaydedilir ve abonelik senkronlanır", async () => {
    stripe.subscriptions.retrieve.mockResolvedValue(subscription());
    await handleStripeEvent(event("checkout.session.completed", { client_reference_id: "u1", customer: "cus_1", subscription: "sub_1" }));
    expect(db.user.updateMany).toHaveBeenCalledWith({ where: { id: "u1", stripeCustomerId: null }, data: { stripeCustomerId: "cus_1" } });
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_1");
    expect(applyPlan).toHaveBeenCalledWith("u1", "PRO");
  });

  it("ilgilenilmeyen olay türü 'ignored' döner ama kaydedilir", async () => {
    expect(await handleStripeEvent(event("customer.created", {}))).toBe("ignored");
    expect(db.stripeEvent.create).toHaveBeenCalled();
  });
});
