import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";

export default async function OverviewPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  const user = await requireUser();
  const t = await getTranslations("Dash.overview");

  const since = new Date(Date.now() - 24 * 3600_000);
  const [monitors, openIncidents, recent] = await Promise.all([
    prisma.monitor.findMany({ where: { userId: user.id }, select: { id: true, isActive: true } }),
    prisma.incident.findMany({ where: { resolvedAt: null, monitor: { userId: user.id } }, select: { monitorId: true } }),
    prisma.incident.findMany({
      where: { startedAt: { gte: since }, monitor: { userId: user.id } },
      include: { monitor: { select: { id: true, name: true } } },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
  ]);

  // Durum veritabanından türetilir (açık olay = çöktü); Kuma'ya istek atılmaz
  const downIds = new Set(openIncidents.map((i) => i.monitorId));
  const active = monitors.filter((m) => m.isActive);
  const down = active.filter((m) => downIds.has(m.id)).length;
  const up = active.length - down;

  const fmt = new Intl.DateTimeFormat(user.locale, { dateStyle: "short", timeStyle: "short", timeZone: user.timezone });

  return (
    <>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      {monitors.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p>{t("empty")}</p>
            <Button asChild>
              <Link href="/dashboard/monitors">{t("addFirst")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [t("total"), monitors.length],
            [t("upCount"), up],
            [t("downCount"), down],
            [t("incidents24h"), recent.length],
          ].map(([label, value]) => (
            <Card key={String(label)}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-bold">{value}</CardContent>
            </Card>
          ))}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("recent")}</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noIncidents")}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {recent.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <Link href={`/dashboard/monitors/${i.monitor.id}`} className="font-medium underline">
                  {i.monitor.name}
                </Link>
                <span className="text-muted-foreground">
                  {fmt.format(i.startedAt)} · {i.resolvedAt ? t("resolved") : t("ongoing")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
