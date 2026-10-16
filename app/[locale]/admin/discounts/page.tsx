import { setRequestLocale } from "next-intl/server";
import { AdminFlash, Check, Field, selectClass } from "@/components/admin/ui";
import { ConfirmSubmit } from "@/components/dashboard/confirm-submit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/admin/guard";
import { getAutoDiscount, listDiscounts, type DiscountRow } from "@/lib/admin/coupons";
import { isStripeConfigured } from "@/lib/stripe/config";
import { Link } from "@/i18n/navigation";
import { createDiscountAction, deactivateDiscountAction, reactivateDiscountAction, setAutoDiscountAction } from "../actions";

export default async function DiscountsPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { ok?: string; error?: string };
}) {
  setRequestLocale(locale);
  await requireAdmin();

  const stripeReady = await isStripeConfigured();
  let rows: DiscountRow[] = [];
  let loadError: string | undefined;
  if (stripeReady) {
    try {
      rows = await listDiscounts();
    } catch (err) {
      loadError = `Could not load discounts from Stripe: ${(err as Error).message}`;
    }
  }
  const auto = await getAutoDiscount();
  const fmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Discounts</h1>
        <p className="text-sm text-muted-foreground">
          Discount codes are Stripe promotion codes. Customers enter them on the Stripe checkout page. Percentage or fixed amount, one-off or recurring.
        </p>
      </div>
      <AdminFlash ok={searchParams.ok} error={searchParams.error ?? loadError} />
      {!stripeReady && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm">
          Connect Stripe to manage discount codes: add your keys under{" "}
          <Link href="/admin/integrations" className="underline">
            Integrations
          </Link>
          .
        </p>
      )}
      {auto && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-emerald-500/10 p-3 text-sm">
          <span>
            Automatic discount ON: <strong>{auto.label}</strong> applies to every checkout (the promo-code box is hidden).
          </span>
          <form action={setAutoDiscountAction}>
            <input type="hidden" name="id" value="" />
            <Button type="submit" variant="outline" size="sm">
              Turn off
            </Button>
          </form>
        </div>
      )}

      {stripeReady && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">New discount code</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createDiscountAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Code" name="code" placeholder="LAUNCH20" required help="3-32 letters, digits or dashes. Stored in upper case." />
              <div className="space-y-1">
                <label htmlFor="kind" className="text-sm font-medium">
                  Type
                </label>
                <select id="kind" name="kind" className={selectClass}>
                  <option value="percent">Percentage off</option>
                  <option value="amount">Fixed amount off (GBP)</option>
                </select>
              </div>
              <Field label="Value" name="value" required help="Percent (e.g. 20) or pounds (e.g. 5.00)" />
              <div className="space-y-1">
                <label htmlFor="duration" className="text-sm font-medium">
                  Applies
                </label>
                <select id="duration" name="duration" className={selectClass}>
                  <option value="once">First payment only</option>
                  <option value="repeating">For a number of months</option>
                  <option value="forever">Forever</option>
                </select>
              </div>
              <Field label="Months (if repeating)" name="months" type="number" min={1} />
              <Field label="Max uses (optional)" name="maxRedemptions" type="number" min={1} />
              <Field label="Expires on (optional)" name="expiresAt" type="date" />
              <fieldset className="space-y-1">
                <legend className="text-sm font-medium">Plans (none selected = all)</legend>
                <Check label="Pro" name="plans" />
                <Check label="Business" name="plans" />
              </fieldset>
              <div className="flex items-end">
                <Check label="New customers only" name="firstTimeOnly" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Button type="submit">Create code</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary">
              <tr>
                {["Code", "Discount", "Duration", "Used", "Expires", "Status", ""].map((h) => (
                  <th key={h} className="p-3" scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <th className="p-3 font-medium" scope="row">
                    {r.code}
                  </th>
                  <td className="p-3">{r.description}</td>
                  <td className="p-3">{r.duration}</td>
                  <td className="p-3">
                    {r.redeemed}
                    {r.maxRedemptions ? ` / ${r.maxRedemptions}` : ""}
                  </td>
                  <td className="p-3">{r.expiresAt ? fmt.format(r.expiresAt) : "–"}</td>
                  <td className="p-3">{r.active ? "Active" : "Inactive"}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {r.active ? (
                        <>
                          <form action={setAutoDiscountAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <Button type="submit" variant="outline" size="sm" title="Apply this discount to every checkout automatically">
                              Apply to all
                            </Button>
                          </form>
                          <form action={deactivateDiscountAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <ConfirmSubmit label="Deactivate" message={`Deactivate ${r.code}?`} />
                          </form>
                        </>
                      ) : (
                        <form action={reactivateDiscountAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <Button type="submit" variant="outline" size="sm">
                            Re-activate
                          </Button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
