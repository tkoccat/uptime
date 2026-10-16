import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConfirmSubmit } from "@/components/dashboard/confirm-submit";
import { Flash } from "@/components/dashboard/flash";
import { Sparkline } from "@/components/dashboard/sparkline";
import { StatusBadge, type DisplayStatus } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getMonitorHistory } from "@/lib/uptimeKuma";
import type { Heartbeat } from "@/lib/uptime-kuma/types";
import { deleteMonitorAction, toggleMonitorAction } from "../../actions";

export default async function MonitorDetailPage({
  params: { locale, id },
  searchParams,
}: {
  params: { locale: string; id: string };
  searchParams: { error?: string; ok?: string };
}) {
  setRequestLocale(locale);
  const user = await requireUser();
  const t = await getTranslations("Dash.monitors");

  // userId koşulu: başkasının monitörü 404 döner
  const monitor = await prisma.monitor.findFirst({ where: { id, userId: user.id } });
  if (!monitor) notFound();

  // Kuma'ya ulaşılamazsa sayfa yine açılır, grafik boş kalır
  let history: Heartbeat[] = [];
  try {
    history = await getMonitorHistory(user.id, monitor.id, "24h");
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    console.error("[monitor detail] geçmiş alınamadı", err);
  }

  const counted = history.filter((b) => b.status === "up" || b.status === "down");
  const uptime = counted.length ? (counted.filter((b) => b.status === "up").length / counted.length) * 100 : null;
  const pings = history.map((b) => b.ping);
  const validPings = pings.filter((p): p is number => p !== null);
  const avg = validPings.length ? Math.round(validPings.reduce((a, b) => a + b, 0) / validPings.length) : null;

  const last = history[history.length - 1];
  const status: DisplayStatus = !monitor.isActive ? "paused" : (last?.status ?? "unknown");
  const fmt = new Intl.DateTimeFormat(user.locale, { dateStyle: "short", timeStyle: "medium", timeZone: user.timezone });
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

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
          {monitor.type === "HEARTBEAT" ? t("types.HEARTBEAT") : monitor.url}
        </p>
      </div>

      <Flash error={searchParams.error} ok={searchParams.ok} />

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

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("uptime")}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{uptime === null ? "–" : `${uptime.toFixed(2)}%`}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("avgPing")}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{avg === null ? "–" : `${avg} ms`}</CardContent>
        </Card>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("last24h")}</h2>
        <Sparkline values={pings} label={t("avgPing")} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("recentChecks")}</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noChecks")}</p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {history
              .slice(-20)
              .reverse()
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

      <div className="flex flex-wrap gap-2">
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
