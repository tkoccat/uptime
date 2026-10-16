import { setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadAdminMetrics } from "@/lib/admin/metrics";
import { requireAdmin } from "@/lib/admin/guard";

export default async function AdminOverviewPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  await requireAdmin();

  const m = await loadAdminMetrics();
  const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

  const tiles: [string, string][] = [
    ["MRR (approx., GBP list price)", gbp.format(m.mrr)],
    ["Paying subscriptions", String(m.payingCount)],
    ["Trials in progress", String(m.trialing)],
    ["Churn (30 days)", m.churn30 === null ? "–" : `${m.churn30.toFixed(1)}%`],
    ["Total users", String(m.totalUsers)],
    ["Signups (7 days)", String(m.signups7)],
    ["Signups (30 days)", String(m.signups30)],
    ["Active users (30 days)", String(m.activeUsers30)],
  ];

  return (
    <>
      <h1 className="text-2xl font-semibold">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{value}</CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Plan distribution</h2>
          <ul className="divide-y rounded-lg border text-sm">
            {m.plans.map((p) => (
              <li key={p.plan} className="flex justify-between p-3">
                <span>{p.plan}</span>
                <span className="font-medium">{p.count}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Signup sources</h2>
          <ul className="divide-y rounded-lg border text-sm">
            {m.sources.map((s) => (
              <li key={s.source} className="flex justify-between p-3">
                <span>{s.source}</span>
                <span className="font-medium">{s.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
