import { setRequestLocale } from "next-intl/server";
import { AdminFlash, Field } from "@/components/admin/ui";
import { ConfirmSubmit } from "@/components/dashboard/confirm-submit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/admin/guard";
import { getStripeKeys } from "@/lib/stripe/config";
import { clearStripeKeysAction, saveStripeKeysAction, testStripeAction } from "../actions";

// Gizli anahtarların değeri asla sayfaya yazılmaz; yalnızca ayarlı olup olmadığı ve son 4 hanesi gösterilir
const mask = (v?: string) => (v ? `••••${v.slice(-4)}` : "not set");

export default async function IntegrationsPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { ok?: string; error?: string };
}) {
  setRequestLocale(locale);
  await requireAdmin();
  const keys = await getStripeKeys();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const mode = keys.secretKey?.includes("_live_") ? "LIVE" : keys.secretKey ? "test" : null;

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">Connect payments without touching the server. Keys are stored encrypted and override environment variables.</p>
      </div>
      <AdminFlash ok={searchParams.ok} error={searchParams.error} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stripe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Secret key</dt>
              <dd>
                {mask(keys.secretKey)} {mode && <span className="text-xs">({mode} mode, from {keys.source === "admin" ? "this panel" : "environment"})</span>}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Webhook signing secret</dt>
              <dd>{mask(keys.webhookSecret)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Publishable key</dt>
              <dd>{keys.publishableKey ?? "not set"}</dd>
            </div>
          </dl>

          <form action={saveStripeKeysAction} className="grid gap-3 sm:grid-cols-2" autoComplete="off">
            <Field label="Secret key" name="secretKey" type="password" placeholder="sk_live_… or sk_test_…" help="Stripe Dashboard > Developers > API keys. Leave empty to keep the current value." />
            <Field label="Webhook signing secret" name="webhookSecret" type="password" placeholder="whsec_…" help="Shown after you create the webhook endpoint below." />
            <Field label="Publishable key" name="publishableKey" placeholder="pk_live_… (optional)" />
            <div className="flex items-end">
              <Button type="submit">Save keys</Button>
            </div>
          </form>

          <div className="flex flex-wrap gap-2">
            <form action={testStripeAction}>
              <Button type="submit" variant="outline">
                Test connection
              </Button>
            </form>
            {keys.source === "admin" && (
              <form action={clearStripeKeysAction}>
                <ConfirmSubmit label="Remove saved keys" message="Remove the keys saved in this panel?" />
              </form>
            )}
          </div>

          <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">Webhook endpoint</p>
            <p>
              In Stripe go to Developers &gt; Webhooks &gt; Add endpoint and use this URL:
            </p>
            <code className="block break-all rounded bg-background p-2 text-xs">{appUrl}/api/webhooks/stripe</code>
            <p className="text-muted-foreground">
              Events: checkout.session.completed, customer.subscription.created / updated / deleted, invoice.payment_succeeded, invoice.payment_failed. Then paste the signing secret above.
            </p>
            <p className="text-muted-foreground">Also enable Stripe Tax and the Customer Portal in your Stripe settings. Prices and products are created automatically from Plans &amp; pricing.</p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
