import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadAdminMetrics } from "@/lib/admin/metrics";
import { requireUser } from "@/lib/auth/current-user";
import { safeEqual } from "@/lib/crypto";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false, follow: false } };

// Yalnızca ADMIN_EMAIL'e ait (e-postası doğrulanmış) hesap görebilir; diğerleri 404 alır.
export default async function AdminPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const user = await requireUser();
  const admin = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!admin || !safeEqual(user.email.toLowerCase(), admin)) notFound();

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
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <h1 className="text-3xl font-bold">Admin</h1>

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
    </main>
  );
}
