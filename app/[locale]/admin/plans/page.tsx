import { setRequestLocale } from "next-intl/server";
import { AdminFlash, Check, Field, money } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/admin/guard";
import { getPlanConfigs, PLAN_ORDER, yearlyDiscountPct } from "@/lib/plan-config";
import { isStripeConfigured } from "@/lib/stripe/config";
import { savePlanAction } from "../actions";

export default async function PlansPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { ok?: string; error?: string };
}) {
  setRequestLocale(locale);
  await requireAdmin();
  const configs = await getPlanConfigs();
  const stripeReady = await isStripeConfigured();

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Plans &amp; pricing</h1>
        <p className="text-sm text-muted-foreground">
          Prices, limits and trial length. The pricing table, checkout and plan limits all read from here.
          Changing a price creates a new Stripe price; existing subscribers keep their current price.
        </p>
      </div>
      <AdminFlash ok={searchParams.ok} error={searchParams.error} />
      {!stripeReady && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm">
          Stripe is not configured (STRIPE_SECRET_KEY). You can still edit limits; prices are saved but checkout stays unavailable until Stripe is connected.
        </p>
      )}

      <div className="space-y-6">
        {PLAN_ORDER.map((plan) => {
          const c = configs[plan];
          const paid = plan !== "FREE";
          const discount = yearlyDiscountPct(c.priceMonthly, c.priceYearly);
          return (
            <Card key={plan}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{plan}</span>
                  {paid && <span className="text-sm font-normal text-muted-foreground">Yearly discount: {discount}%</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form action={savePlanAction} className="space-y-4">
                  <input type="hidden" name="plan" value={plan} />

                  {paid && (
                    <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <legend className="mb-1 text-sm font-medium">Price (excluding VAT)</legend>
                      <Field label="GBP monthly (£)" name="priceMonthly" defaultValue={money(c.priceMonthly)} required step="0.01" />
                      <Field label="GBP yearly (£)" name="priceYearly" defaultValue={money(c.priceYearly)} required step="0.01" />
                      <span />
                      <Field label="EUR monthly (€, optional)" name="eurMonthly" defaultValue={money(c.eurMonthly)} />
                      <Field label="EUR yearly (€, optional)" name="eurYearly" defaultValue={money(c.eurYearly)} />
                      <span />
                      <Field label="USD monthly ($, optional)" name="usdMonthly" defaultValue={money(c.usdMonthly)} />
                      <Field label="USD yearly ($, optional)" name="usdYearly" defaultValue={money(c.usdYearly)} />
                    </fieldset>
                  )}

                  <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <legend className="mb-1 text-sm font-medium">Limits</legend>
                    <Field label="Monitors" name="monitors" type="number" min={1} defaultValue={c.monitors} required />
                    <Field label="Fastest check (seconds)" name="minInterval" type="number" min={20} defaultValue={c.minInterval} required />
                    <Field label="Status pages" name="statusPages" type="number" min={0} defaultValue={c.statusPages} required />
                    <Field label="Free trial (days, 0 = none)" name="trialDays" type="number" min={0} defaultValue={c.trialDays} required />
                  </fieldset>

                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    <Check label="Custom domains" name="customDomain" defaultChecked={c.customDomain} />
                    <Check label="REST API access" name="api" defaultChecked={c.api} />
                    <Check label="Highlight on pricing page" name="highlight" defaultChecked={c.highlight} />
                    <Check label="Available for sale" name="isActive" defaultChecked={c.isActive} help="Hidden from the pricing page and checkout when off" />
                  </div>

                  {paid && (
                    <p className="break-all text-xs text-muted-foreground">
                      Stripe product: {c.stripeProductId ?? "none yet"} · monthly price: {c.stripePriceMonthly ?? "none yet"} · yearly price:{" "}
                      {c.stripePriceYearly ?? "none yet"} · retired prices: {c.stripePriceHistory.length}
                    </p>
                  )}
                  <Button type="submit">Save {plan}</Button>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
