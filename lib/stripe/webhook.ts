import type { Plan, SubscriptionStatus } from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "../prisma";
import { queueUserEmail } from "../notify/user-email";
import { getStripe } from "./client";
import { applyPlan } from "./plan-change";
import { planFromPriceId } from "./prices";

const STATUS_MAP: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  trialing: "TRIALING",
  active: "ACTIVE",
  past_due: "PAST_DUE",
  canceled: "CANCELED",
  incomplete: "INCOMPLETE",
  incomplete_expired: "CANCELED",
  unpaid: "UNPAID",
  paused: "UNPAID",
};

// Bu durumlarda kullanıcı ücretli planın özelliklerini kullanmaya devam eder
const ENTITLED: SubscriptionStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE"];

function customerId(c: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!c) return null;
  return typeof c === "string" ? c : c.id;
}

async function findUserId(sub: Stripe.Subscription): Promise<string | null> {
  const fromMeta = sub.metadata?.userId;
  if (fromMeta) return fromMeta;
  const cid = customerId(sub.customer);
  if (!cid) return null;
  const user = await prisma.user.findUnique({ where: { stripeCustomerId: cid }, select: { id: true } });
  return user?.id ?? null;
}

/** Stripe aboneliğini yerel Subscription kaydına ve kullanıcı planına yansıtır. */
export async function syncSubscription(sub: Stripe.Subscription) {
  const userId = await findUserId(sub);
  if (!userId) throw new Error(`Aboneliğin sahibi bulunamadı: ${sub.id}`);

  const item = sub.items.data[0];
  const priceId = item?.price.id;
  const plan = priceId ? planFromPriceId(priceId) : null;
  // Bilinmeyen fiyat: sessizce tahmin etmek yerine hata verip Stripe'ın yeniden denemesine bırak
  if (!plan) throw new Error(`Bilinmeyen Stripe fiyatı: ${priceId}`);

  const status = STATUS_MAP[sub.status];
  const periodEnd = new Date((item.current_period_end ?? 0) * 1000);
  const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null;

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    create: {
      userId,
      plan,
      status,
      currentPeriodEnd: periodEnd,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEnd,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    },
    update: {
      plan,
      status,
      currentPeriodEnd: periodEnd,
      stripePriceId: priceId,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEnd,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    },
  });

  const effective: Plan = ENTITLED.includes(status) ? plan : "FREE";
  await applyPlan(userId, effective);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const userId = await findUserId(sub);
  if (!userId) return;
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: sub.id },
    data: { status: "CANCELED", canceledAt: new Date() },
  });

  // Başka aktif aboneliği yoksa Free'ye düşür
  const stillActive = await prisma.subscription.count({
    where: { userId, status: { in: ENTITLED }, stripeSubscriptionId: { not: sub.id } },
  });
  if (stillActive === 0) {
    const before = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
    await applyPlan(userId, "FREE");
    if (before && before.plan !== "FREE") {
      await queueUserEmail(userId, "subscription_canceled", { plan: before.plan }, "/pricing");
    }
  }
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

async function userForInvoice(invoice: Stripe.Invoice) {
  const cid = customerId(invoice.customer);
  if (!cid) return null;
  return prisma.user.findUnique({ where: { stripeCustomerId: cid } });
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const user = await userForInvoice(invoice);
  if (!user) return;
  await prisma.user.update({ where: { id: user.id }, data: { paymentFailedCount: 0 } });
  // Sıfır tutarlı (deneme) faturalar için "ödeme alındı" e-postası gönderilmez
  if (invoice.amount_paid > 0) {
    await queueUserEmail(user.id, "payment_succeeded", { plan: user.plan }, "/dashboard/billing");
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const user = await userForInvoice(invoice);
  if (!user) return;

  const attempt = invoice.attempt_count;
  await prisma.user.update({ where: { id: user.id }, data: { paymentFailedCount: attempt } });
  await queueUserEmail(user.id, "payment_failed", { plan: user.plan, attempt: Math.min(attempt, 3) }, "/dashboard/billing");

  // 3. başarısız denemede aboneliği iptal et ve Free'ye düşür
  if (attempt >= 3) {
    const subId = invoiceSubscriptionId(invoice);
    if (subId) await getStripe().subscriptions.cancel(subId).catch((e) => console.error("[stripe] iptal edilemedi", e));
    await prisma.subscription.updateMany({ where: { userId: user.id, status: { in: ENTITLED } }, data: { status: "CANCELED", canceledAt: new Date() } });
    await applyPlan(user.id, "FREE");
    await queueUserEmail(user.id, "subscription_canceled", { plan: user.plan }, "/pricing");
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id;
  const cid = customerId(session.customer);
  if (userId && cid) {
    await prisma.user.updateMany({ where: { id: userId, stripeCustomerId: null }, data: { stripeCustomerId: cid } });
  }
  const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (subId) await syncSubscription(await getStripe().subscriptions.retrieve(subId));
}

/** Doğrulanmış bir Stripe olayını işler. Aynı olay iki kez gelirse ikincisi atlanır. */
export async function handleStripeEvent(event: Stripe.Event): Promise<"processed" | "duplicate" | "ignored"> {
  const seen = await prisma.stripeEvent.findUnique({ where: { id: event.id } });
  if (seen) return "duplicate";

  let handled = true;
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await syncSubscription(event.data.object);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object);
      break;
    case "invoice.payment_succeeded":
      await handlePaymentSucceeded(event.data.object);
      break;
    case "invoice.payment_failed":
      await handlePaymentFailed(event.data.object);
      break;
    default:
      handled = false;
  }

  // Yalnızca başarıyla işlenenler kaydedilir; hata olursa Stripe olayı yeniden gönderir
  await prisma.stripeEvent.create({ data: { id: event.id, type: event.type } });
  return handled ? "processed" : "ignored";
}
