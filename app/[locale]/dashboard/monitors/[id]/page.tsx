import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConfirmSubmit } from "@/components/dashboard/confirm-submit";
import { Flash } from "@/components/dashboard/flash";
import { HeartbeatBar } from "@/components/dashboard/heartbeat-bar";
import { ResponseChart } from "@/components/dashboard/response-chart";
import { StatusBadge, type DisplayStatus } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { NotFoundError } from "@/lib/errors";
import { readOptions } from "@/lib/monitor-options";
import { prisma } from "@/lib/prisma";
import { getMonitorChart, uptimeFromDaily, type ChartRange, type MonitorChart } from "@/lib/uptimeKuma";
import { deleteMonitorAction, toggleMonitorAction } from "../../actions";

const RANGES: ChartRange[] = ["24h", "7d", "30d"];

function duration(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ${m % 60} min` : `${Math.floor(h / 24)} d ${h % 24} h`;
}

export default async function MonitorDetailPage({
  params: { locale, id },
  searchParams,
}: {
  params: { locale: string; id: string };
  searchParams: { error?: string; ok?: string; range?: string };
}) {
  setRequestLocale(locale);
  const user = await requireUser();
  const t = await getTranslations("Dash.monitors");

  // userId koşulu: başkasının monitörü 404 döner
  const monitor = await prisma.monitor.findFirst({ where: { id, userId: user.id } });
  if (!monitor) notFound();

  const range: ChartRange = RANGES.includes(searchParams.range as ChartRange) ? (searchParams.range as ChartRange) : "24h";
  const now = new Date();

  // Kuma'ya ulaşılamazsa sayfa yine açılır, grafik boş kalır
  let chart: MonitorChart | null = null;
  try {
    chart = await getMonitorChart(user.id, monitor.id, range);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    console.error("[monitor detail] geçmiş alınamadı", err);
  }

  const [daily30, incidents, maintenance] = await Promise.all([
    uptimeFromDaily([monitor.id], 30),
    prisma.incident.findMany({ where: { monitorId: monitor.id }, orderBy: { startedAt: "desc" }, take: 10 }),
    prisma.maintenance.findFirst({ where: { monitors: { some: { id: monitor.id } }, startsAt: { lte: now }, endsAt: { gt: now } } }),
  ]);

  const recent = chart?.recent ?? [];
  const last = recent[recent.length - 1];
  const openIncident = incidents.find((i) => !i.resolvedAt);
  const status: DisplayStatus = !monitor.isActive ? "paused" : maintenance ? "maintenance" : openIncident ? "down" : (last?.status ?? "unknown");

  const checks = chart ? chart.up + chart.down : 0;
  const rangeUptime = chart && checks > 0 ? (chart.up / checks) * 100 : null;
  const uptime30 = daily30.get(monitor.id) ?? null;
  const opts = readOptions(monitor.options);

  const fmt = new Intl.DateTimeFormat(user.locale, { dateStyle: "short", timeStyle: "medium", timeZone: user.timezone });
  const fmtTime = new Intl.DateTimeFormat(user.locale, { hour: "2-digit", minute: "2-digit", timeZone: user.timezone });
  const fmtDay = new Intl.DateTimeFormat(user.locale, { day: "numeric", month: "short", timeZone: user.timezone });
  const formatX = (ts: number) => (range === "24h" ? fmtTime.format(ts) : fmtDay.format(ts));
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

  const stat = (label: string, value: string) => (
    <Card key={label}>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-bold">{value}</CardContent>
    </Card>
  );

  return (
    <>
      <div className="space-y-1">
        <Link href="/dashboard/monitors" className="text-sm underline">
          ← {t("title")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{monitor.name}</h1>
          <StatusBadge status={status} />
        </div>
        <p className="break-all text-sm text-muted-foreground">
          {monitor.type === "HEARTBEAT" ? t("types.HEARTBEAT") : monitor.url} · {t(`types.${monitor.type}`)}
        </p>
        {monitor.description && <p className="text-sm">{monitor.description}</p>}
        {monitor.tags.length > 0 && (
          <p className="flex flex-wrap gap-1">
            {monitor.tags.map((x) => (
              <span key={x} className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">
                {x}
              </span>
            ))}
          </p>
        )}
      </div>

      <Flash error={searchParams.error} ok={searchParams.ok} />

      {maintenance && <p className="rounded-md bg-blue-500/10 p-3 text-sm">{t("inMaintenance", { title: maintenance.title, end: fmt.format(maintenance.endsAt) })}</p>}

      {monitor.type === "HEARTBEAT" && monitor.pingToken && (
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="text-lg font-semibold">{t("pingUrl")}</h2>
          <code className="block break-all rounded bg-muted p-2 text-sm">{`${appUrl}/api/ping/${monitor.pingToken}`}</code>
          <p className="text-sm text-muted-foreground">{t("pingUrlHelp")}</p>
          <p className="text-xs font-medium">{t("example")}</p>
          <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{`# success\ncurl -fsS -m 10 --retry 3 ${appUrl}/api/ping/${monitor.pingToken}\n\n# failure\ncurl -fsS -m 10 --retry 3 ${appUrl}/api/ping/${monitor.pingToken}/fail`}</pre>
          <p className="text-xs text-muted-foreground">
            {t("lastPing")}: {monitor.lastPingAt ? fmt.format(monitor.lastPingAt) : t("neverPinged")} · {t("period")}: {monitor.interval}s · {t("grace")}: {monitor.graceSeconds}s
          </p>
          <p className="text-xs text-muted-foreground">{t("keepSecret")}</p>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">{t("recentChecks")}</h2>
        <HeartbeatBar beats={recent} size={60} label={t("recentChecks")} className="h-8" />
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stat(t("current"), last?.ping != null ? `${last.ping} ms` : "–")}
        {stat(t("avgPing"), chart?.avg != null ? `${chart.avg} ms` : "–")}
        {stat(`${t("uptime")} (${t(`range.${range}`)})`, rangeUptime === null ? "–" : `${rangeUptime.toFixed(2)}%`)}
        {stat(`${t("uptime")} (${t("range.30d")})`, uptime30 === null ? "–" : `${uptime30.toFixed(2)}%`)}
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{t("responseTime")}</h2>
          <nav className="flex gap-1" aria-label={t("responseTime")}>
            {RANGES.map((r) => (
              <Button key={r} asChild size="sm" variant={r === range ? "default" : "outline"}>
                <Link href={`/dashboard/monitors/${monitor.id}?range=${r}`} aria-current={r === range ? "true" : undefined}>
                  {t(`range.${r}`)}
                </Link>
              </Button>
            ))}
          </nav>
        </div>
        <ResponseChart points={chart?.points ?? []} label={t("responseTime")} formatX={formatX} emptyText={t("chartEmpty")} />
        {chart && chart.min !== null && (
          <p className="text-xs text-muted-foreground">
            {t("fastest")}: {chart.min} ms · {t("avgPing")}: {chart.avg} ms · {t("slowest")}: {chart.max} ms · {t("checks")}: {checks}
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("incidents")}</h2>
        {incidents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noIncidents")}</p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {incidents.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span>{fmt.format(i.startedAt)}</span>
                <span className="text-muted-foreground">{i.message ?? ""}</span>
                <span className={i.resolvedAt ? "text-muted-foreground" : "font-medium text-red-600 dark:text-red-400"}>
                  {i.resolvedAt ? `${t("duration")}: ${duration(i.resolvedAt.getTime() - i.startedAt.getTime())}` : t("ongoing")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("recentChecksList")}</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noChecks")}</p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {[...recent]
              .reverse()
              .slice(0, 20)
              .map((b) => (
                <li key={b.time} className="flex flex-wrap items-center justify-between gap-2 p-2">
                  <span>{fmt.format(new Date(b.time))}</span>
                  <span className="text-muted-foreground">{b.ping !== null ? `${b.ping} ms` : (b.message ?? "")}</span>
                  <StatusBadge status={b.status} />
                </li>
              ))}
          </ul>
        )}
      </section>

      {monitor.type !== "HEARTBEAT" && (
        <p className="text-xs text-muted-foreground">
          {t("settingsSummary", { retries: opts.retries, status: opts.acceptedStatus.join(", "), method: opts.method })}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href={`/dashboard/monitors/${monitor.id}/edit`}>{t("edit")}</Link>
        </Button>
        <form action={toggleMonitorAction}>
          <input type="hidden" name="id" value={monitor.id} />
          <input type="hidden" name="active" value={String(!monitor.isActive)} />
          <Button type="submit" variant="outline">
            {monitor.isActive ? t("pause") : t("resume")}
          </Button>
        </form>
        <form action={deleteMonitorAction}>
          <input type="hidden" name="id" value={monitor.id} />
          <ConfirmSubmit label={t("delete")} message={t("deleteConfirm")} className="text-destructive" />
        </form>
      </div>
    </>
  );
}
