import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { AdminFlash, Check, Field, selectClass } from "@/components/admin/ui";
import { ConfirmSubmit } from "@/components/dashboard/confirm-submit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { isAdminEmail, requireAdmin } from "@/lib/admin/guard";
import { getUserDetail } from "@/lib/admin/users";
import { NotFoundError } from "@/lib/errors";
import { deleteUserAction, extendTrialAction, setUserPlanAction, suspendUserAction, unlockUserPlanAction } from "../../actions";

export default async function UserDetailPage({
  params: { locale, id },
  searchParams,
}: {
  params: { locale: string; id: string };
  searchParams: { ok?: string; error?: string };
}) {
  setRequestLocale(locale);
  await requireAdmin();

  let u;
  try {
    u = await getUserDetail(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const isAdminUser = isAdminEmail(u.email);
  const fmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
  const trialing = u.subscriptions.find((s) => s.status === "TRIALING");

  return (
    <>
      <div className="space-y-1">
        <Link href="/admin/users" className="text-sm underline">
          ← Users
        </Link>
        <h1 className="break-all text-2xl font-semibold">{u.email}</h1>
        <p className="text-sm text-muted-foreground">
          Joined {fmt.format(u.createdAt)} · language {u.locale} · {u.timezone}
          {u.utmSource ? ` · source ${u.utmSource}` : ""}
        </p>
      </div>
      <AdminFlash ok={searchParams.ok} error={searchParams.error} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Plan", `${u.plan}${u.planLocked ? " (locked)" : ""}`],
          ["Status", u.suspendedAt ? "Suspended" : "Active"],
          ["Monitors", String(u._count.monitors)],
          ["Status pages / API keys", `${u._count.statusPages} / ${u._count.apiKeys}`],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-bold">{value}</CardContent>
          </Card>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Plan</h2>
        <form action={setUserPlanAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={u.id} />
          <div className="space-y-1">
            <label htmlFor="plan" className="text-sm font-medium">
              Set plan
            </label>
            <select id="plan" name="plan" defaultValue={u.plan} className={selectClass}>
              {["FREE", "PRO", "BUSINESS"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <Check label="Lock (complimentary plan)" name="lock" defaultChecked={u.planLocked} help="Stripe events will not change a locked plan" />
          <Button type="submit">Apply</Button>
        </form>
        {u.planLocked && (
          <form action={unlockUserPlanAction}>
            <input type="hidden" name="id" value={u.id} />
            <Button type="submit" variant="outline">
              Unlock and re-sync with subscription
            </Button>
          </form>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Subscription</h2>
        {u.subscriptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subscriptions.</p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {u.subscriptions.map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 p-3">
                <span>
                  {s.plan} · {s.status}
                  {s.cancelAtPeriodEnd ? " · cancels at period end" : ""}
                </span>
                <span className="text-muted-foreground">
                  {s.status === "TRIALING" && s.trialEnd ? `trial ends ${fmt.format(s.trialEnd)}` : `renews ${fmt.format(s.currentPeriodEnd)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        {trialing && (
          <form action={extendTrialAction} className="flex items-end gap-3">
            <input type="hidden" name="id" value={u.id} />
            <Field label="Extend trial by (days)" name="days" type="number" min={1} defaultValue={7} />
            <Button type="submit" variant="outline">
              Extend trial
            </Button>
          </form>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Monitors</h2>
        {u.monitors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No monitors.</p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {u.monitors.map((m) => (
              <li key={m.id} className="flex flex-wrap justify-between gap-2 p-3">
                <span className="break-all">
                  {m.name} · {m.url}
                </span>
                <span className="text-muted-foreground">{m.isActive ? "active" : "paused"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!isAdminUser && (
        <section className="space-y-3 rounded-lg border border-destructive/40 p-4">
          <h2 className="text-lg font-semibold text-destructive">Danger zone</h2>
          <form action={suspendUserAction}>
            <input type="hidden" name="id" value={u.id} />
            <input type="hidden" name="suspend" value={String(!u.suspendedAt)} />
            <ConfirmSubmit
              label={u.suspendedAt ? "Re-enable account" : "Suspend account"}
              message={u.suspendedAt ? "Re-enable this account and resume its monitors?" : "Suspend this account? They will be locked out and monitors paused."}
            />
          </form>
          <form action={deleteUserAction} className="space-y-2">
            <input type="hidden" name="id" value={u.id} />
            <Field label="Type the user's email to delete the account permanently" name="confirmEmail" placeholder={u.email} required />
            <ConfirmSubmit label="Delete account and all data" message="This permanently deletes the account, monitors and subscription. Continue?" className="text-destructive" />
          </form>
        </section>
      )}
    </>
  );
}
