import { getTranslations, setRequestLocale } from "next-intl/server";
import { Flash } from "@/components/dashboard/flash";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/current-user";
import { planPrices } from "@/lib/marketing/content";
import { limitsFor } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { CURRENCIES } from "@/lib/stripe/prices";
import { checkoutAction, portalAction } from "../actions";

export default async function BillingPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { error?: string; checkout?: string };
}) {
  setRequestLocale(locale);
  const user = await requireUser();
  const t = await getTranslations("Dash.billing");
  const tp = await getTranslations("Pricing.plans");

  const [monitorCount, subscription] = await Promise.all([
    prisma.monitor.count({ where: { userId: user.id } }),
    prisma.subscription.findFirst({
      where: { userId: user.id, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] } },
      orderBy: { currentPeriodEnd: "desc" },
    }),
  ]);
  const limits = limitsFor(user.plan);
  const date = (d: Date) => new Intl.DateTimeFormat(user.locale, { dateStyle: "long", timeZone: user.timezone }).format(d);
  const configured = Boolean(process.env.STRIPE_SECRET_KEY);

  return (
    <>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Flash error={searchParams.error} />
      {searchParams.checkout === "success" && <p className="rounded-md bg-muted p-3 text-sm">{t("checkoutSuccess")}</p>}
      {searchParams.checkout === "canceled" && <p className="rounded-md bg-muted p-3 text-sm">{t("checkoutCanceled")}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("currentPlan")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-bold">{tp(`${user.plan.toLowerCase()}.name`)}</p>
            {subscription && (
              <p className="text-sm text-muted-foreground">
                {subscription.status === "TRIALING" && subscription.trialEnd
                  ? t("trialEnds", { date: date(subscription.trialEnd) })
                  : subscription.cancelAtPeriodEnd
                    ? t("cancelsOn", { date: date(subscription.currentPeriodEnd) })
                    : t("renewsOn", { date: date(subscription.currentPeriodEnd) })}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("usage")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {t("monitorsUsed", { used: monitorCount, limit: limits.monitors })}
          </CardContent>
        </Card>
      </div>

      {!configured ? (
        <p className="text-sm text-muted-foreground">{t("notConfigured")}</p>
      ) : (
        <>
          {user.stripeCustomerId && (
            <form action={portalAction}>
              <Button type="submit" variant="outline">
                {t("manage")}
              </Button>
            </form>
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t("upgradeTitle")}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {planPrices
                .filter((p) => p.id !== "free")
                .map((p) => {
                  const planKey = p.id.toUpperCase();
                  const isCurrent = user.plan === planKey;
                  return (
                    <Card key={p.id}>
                      <CardHeader className="pb-2">
                        <CardTitle>{tp(`${p.id}.name`)}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <form action={checkoutAction} className="space-y-3">
                          <input type="hidden" name="plan" value={planKey} />
                          <select
                            name="billing"
                            defaultValue="monthly"
                            aria-label={t("upgradeTitle")}
                            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          >
                            <option value="monthly">
                              {t("monthly")} · £{p.monthly}
                            </option>
                            <option value="yearly">
                              {t("yearly")} · £{p.yearly}
                            </option>
                          </select>
                          <select
                            name="currency"
                            defaultValue="gbp"
                            aria-label="Currency"
                            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          >
                            {CURRENCIES.map((c) => (
                              <option key={c} value={c}>
                                {c.toUpperCase()}
                              </option>
                            ))}
                          </select>
                          <Button type="submit" className="w-full" disabled={isCurrent}>
                            {isCurrent ? t("current") : t("choose", { plan: tp(`${p.id}.name`) })}
                          </Button>
                        </form>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </section>
        </>
      )}
    </>
  );
}
