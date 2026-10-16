import type Stripe from "stripe";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const adapter = vi.hoisted(() => ({ setMonitorActive: vi.fn(async () => undefined) }));
vi.mock("@/lib/uptime-kuma", () => ({ getAdapter: () => adapter }));

const stripe = vi.hoisted(() => ({
  subscriptions: { retrieve: vi.fn(), cancel: vi.fn(async () => ({})) },
}));
vi.mock("@/lib/stripe/client", () => ({ getStripe: () => stripe }));

const queued = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/lib/notify/user-email", () => ({ queueUserEmail: queued }));

import { invalidatePlanConfigs, DEFAULT_PLAN_CONFIGS } from "@/lib/plan-config";
import { prisma } from "@/lib/prisma";
import { handleStripeEvent } from "@/lib/stripe/webhook";
import { mkMonitor, mkUser } from "./helpers";

let eventN = 0;
const event = (type: string, object: unknown) => ({ id: `evt_${++eventN}_${Date.now()}`, type, data: { object } }) as unknown as Stripe.Event;

const subscription = (userId: string, over: Record<string, unknown> = {}) =>
  ({
    id: `sub_${userId}`,
    customer: `cus_${userId}`,
    status: "active",
    metadata: { userId },
    cancel_at_period_end: false,
    trial_end: null,
    canceled_at: null,
    items: { data: [{ price: { id: "price_pro_m" }, current_period_end: 1_900_000_000 }] },
    ...over,
  }) as unknown as Stripe.Subscription;

beforeEach(() => {
  vi.clearAllMocks();
  invalidatePlanConfigs();
});

describe("Stripe webhook'ları (gerçek veritabanı)", () => {
  it("abonelik oluşur: kayıt yazılır, plan Pro olur; aynı olay ikinci kez işlenmez", async () => {
    const u = await mkUser("FREE");
    const ev = event("customer.subscription.created", subscription(u.id));

    expect(await handleStripeEvent(ev)).toBe("processed");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).plan).toBe("PRO");
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { stripeSubscriptionId: `sub_${u.id}` } });
    expect(sub).toMatchObject({ userId: u.id, plan: "PRO", status: "ACTIVE", stripePriceId: "price_pro_m" });

    // aynı olay: atlanır, kayıt çoğalmaz
    expect(await handleStripeEvent(ev)).toBe("duplicate");
    expect(await prisma.subscription.count({ where: { userId: u.id } })).toBe(1);
    expect(await prisma.stripeEvent.count({ where: { id: ev.id } })).toBe(1);
  });

  it("deneme sürümünde ücretli özellikler açılır ve deneme bitişi saklanır", async () => {
    const u = await mkUser("FREE");
    await handleStripeEvent(event("customer.subscription.created", subscription(u.id, { status: "trialing", trial_end: 1_890_000_000 })));
    const sub = await prisma.subscription.findFirstOrThrow({ where: { userId: u.id } });
    expect(sub.status).toBe("TRIALING");
    expect(sub.trialEnd).toEqual(new Date(1_890_000_000 * 1000));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).plan).toBe("PRO");
  });

  it("ödenmemiş aboneliğe düşünce Free'ye iner ve fazla monitörler duraklatılır (en yeniler)", async () => {
    const u = await mkUser("PRO");
    const ms = [];
    for (let i = 0; i < 8; i++) ms.push(await mkMonitor(u.id));
    await handleStripeEvent(event("customer.subscription.created", subscription(u.id)));
    adapter.setMonitorActive.mockClear();

    await handleStripeEvent(event("customer.subscription.updated", subscription(u.id, { status: "unpaid" })));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).plan).toBe("FREE");
    const rows = await prisma.monitor.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } });
    expect(rows.filter((r) => r.isActive)).toHaveLength(5);
    expect(rows.filter((r) => !r.isActive).map((r) => r.id)).toEqual(ms.slice(5).map((m) => m.id));
    expect(adapter.setMonitorActive).toHaveBeenCalledTimes(3);
  });

  it("admin'in kilitlediği plan Stripe olaylarıyla değişmez", async () => {
    const u = await mkUser("BUSINESS", { planLocked: true });
    await handleStripeEvent(event("customer.subscription.created", subscription(u.id)));
    await handleStripeEvent(event("customer.subscription.deleted", subscription(u.id, { status: "canceled" })));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).plan).toBe("BUSINESS");
  });

  it("3. başarısız ödemede abonelik iptal edilir ve kullanıcı Free'ye düşer", async () => {
    const u = await mkUser("PRO", { stripeCustomerId: `cus_fail_${Date.now()}` });
    await handleStripeEvent(event("customer.subscription.created", subscription(u.id, { customer: u.stripeCustomerId })));
    const invoice = (attempt: number) => ({ customer: u.stripeCustomerId, attempt_count: attempt, parent: { subscription_details: { subscription: `sub_${u.id}` } } });

    await handleStripeEvent(event("invoice.payment_failed", invoice(2)));
    let row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row).toMatchObject({ plan: "PRO", paymentFailedCount: 2 });

    await handleStripeEvent(event("invoice.payment_failed", invoice(3)));
    row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row.plan).toBe("FREE");
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith(`sub_${u.id}`);
    expect((await prisma.subscription.findFirstOrThrow({ where: { userId: u.id } })).status).toBe("CANCELED");
  });

  it("başarılı ödeme başarısızlık sayacını sıfırlar", async () => {
    const u = await mkUser("PRO", { stripeCustomerId: `cus_ok_${Date.now()}`, paymentFailedCount: 2 });
    await handleStripeEvent(event("invoice.payment_succeeded", { customer: u.stripeCustomerId, amount_paid: 900, attempt_count: 1 }));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).paymentFailedCount).toBe(0);
  });

  it("admin fiyat değiştirdikten sonra eski fiyattaki abone doğru plana eşlenir", async () => {
    const u = await mkUser("FREE");
    await prisma.planConfig.upsert({
      where: { plan: "PRO" },
      create: { ...DEFAULT_PLAN_CONFIGS.PRO, stripePriceMonthly: "price_new_m", stripePriceYearly: "price_new_y", stripePriceHistory: ["price_legacy_m"] },
      update: { stripePriceMonthly: "price_new_m", stripePriceYearly: "price_new_y", stripePriceHistory: ["price_legacy_m"] },
    });
    invalidatePlanConfigs();

    const legacy = subscription(u.id, { items: { data: [{ price: { id: "price_legacy_m" }, current_period_end: 1_900_000_000 }] } });
    await handleStripeEvent(event("customer.subscription.created", legacy));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).plan).toBe("PRO");

    const u2 = await mkUser("FREE");
    await handleStripeEvent(event("customer.subscription.created", subscription(u2.id, { items: { data: [{ price: { id: "price_new_y" }, current_period_end: 1_900_000_000 }] } })));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u2.id } })).plan).toBe("PRO");
  });

  it("bilinmeyen fiyat hata verir ve olay kaydedilmez (Stripe yeniden dener)", async () => {
    const u = await mkUser("FREE");
    const ev = event("customer.subscription.created", subscription(u.id, { items: { data: [{ price: { id: "price_unknown" }, current_period_end: 1 }] } }));
    await expect(handleStripeEvent(ev)).rejects.toThrow(/Bilinmeyen Stripe fiyatı/);
    expect(await prisma.stripeEvent.count({ where: { id: ev.id } })).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).plan).toBe("FREE");
  });
});

// Plan ayarlarını değiştiren testler sonrası diğer dosyalar varsayılanlarla çalışsın
afterAll(async () => {
  await prisma.planConfig.deleteMany();
  invalidatePlanConfigs();
});
