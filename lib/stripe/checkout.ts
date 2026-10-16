import type { User } from "@prisma/client";
import { prisma } from "../prisma";
import { getPlanConfigs } from "../plan-config";
import { getAutoDiscount } from "../admin/coupons";
import { getStripe } from "./client";
import { priceIdFor, type Billing, type Currency, type PaidPlan } from "./prices";

const STRIPE_LOCALES = ["en", "de", "fr", "tr"] as const;

async function ensureCustomer(user: User): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await (await getStripe()).customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId: user.id },
    preferred_locales: [user.locale],
  });
  await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

export async function createCheckoutUrl(params: {
  user: User;
  plan: PaidPlan;
  billing: Billing;
  currency?: Currency;
  appUrl: string;
}): Promise<string> {
  const { user, plan, billing, currency, appUrl } = params;
  const customer = await ensureCustomer(user);

  // Deneme süresi admin panelindeki plan ayarından gelir (0 = deneme yok); her kullanıcıya yalnızca bir kez
  const hadSubscription = (await prisma.subscription.count({ where: { userId: user.id } })) > 0;
  const planCfg = (await getPlanConfigs())[plan];
  if (!planCfg.isActive) throw new Error("Bu plan şu an satışta değil");
  const trial = planCfg.trialDays > 0 && !hadSubscription ? planCfg.trialDays : undefined;

  const locale = (STRIPE_LOCALES as readonly string[]).includes(user.locale) ? user.locale : "auto";
  const prefix = user.locale === "en" ? "" : `/${user.locale}`;

  const auto = await getAutoDiscount();
  const session = await (await getStripe()).checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: user.id,
    line_items: [{ price: await priceIdFor(plan, billing), quantity: 1 }],
    // Stripe Tax: UK KDV ve AB KDV'si otomatik hesaplanır (Stripe panelinde Tax etkin olmalı)
    automatic_tax: { enabled: true },
    tax_id_collection: { enabled: true },
    customer_update: { address: "auto", name: "auto" },
    // Otomatik indirim (admin panelinden) varsa o uygulanır, yoksa müşteri kod girebilir
    ...(auto ? { discounts: [{ coupon: auto.couponId }] } : { allow_promotion_codes: true }),
    // Çoklu para birimi: fiyatta currency_options tanımlıysa seçilen birim kullanılır
    ...(currency && currency !== "gbp" ? { currency } : {}),
    subscription_data: {
      trial_period_days: trial,
      metadata: { userId: user.id },
    },
    locale: locale as "en" | "de" | "fr" | "tr" | "auto",
    success_url: `${appUrl}${prefix}/dashboard/billing?checkout=success`,
    cancel_url: `${appUrl}${prefix}/dashboard/billing?checkout=canceled`,
  });

  if (!session.url) throw new Error("Stripe Checkout adresi dönmedi");
  return session.url;
}

export async function createPortalUrl(user: User, appUrl: string): Promise<string> {
  if (!user.stripeCustomerId) throw new Error("Stripe müşterisi yok");
  const prefix = user.locale === "en" ? "" : `/${user.locale}`;
  const session = await (await getStripe()).billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${appUrl}${prefix}/dashboard/billing`,
  });
  return session.url;
}
