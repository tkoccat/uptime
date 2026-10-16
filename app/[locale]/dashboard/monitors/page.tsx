import { getTranslations, setRequestLocale } from "next-intl/server";
import { Flash } from "@/components/dashboard/flash";
import { MonitorForm } from "@/components/dashboard/monitor-form";
import { Modal } from "@/components/dashboard/modal";
import { StatusBadge, type DisplayStatus } from "@/components/dashboard/status-badge";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { getLimits } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { createMonitorAction } from "../actions";

const TYPES = ["HTTP", "KEYWORD", "PING", "PORT", "DNS", "HEARTBEAT"] as const;
const INTERVALS = [30, 60, 120, 180, 300, 600, 900, 1800, 3600];
// Heartbeat: işin beklenen çalışma sıklığı (dakikalıktan haftalığa) ve gecikme toleransı
const PERIODS = [60, 300, 900, 1800, 3600, 21600, 43200, 86400, 604800];
const GRACES = [0, 60, 300, 900, 1800, 3600, 21600, 86400];

export default async function MonitorsPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { error?: string; ok?: string };
}) {
  setRequestLocale(locale);
  const user = await requireUser();
  const t = await getTranslations("Dash.monitors");
  const tc = await getTranslations("Dash.common");

  const limits = await getLimits(user.plan);
  const [monitors, open] = await Promise.all([
    prisma.monitor.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.incident.findMany({ where: { resolvedAt: null, monitor: { userId: user.id } }, select: { monitorId: true } }),
  ]);
  const downIds = new Set(open.map((i) => i.monitorId));
  const statusOf = (m: { id: string; isActive: boolean }): DisplayStatus =>
    !m.isActive ? "paused" : downIds.has(m.id) ? "down" : "up";

  // Süre etiketi: saniye / dakika / saat / gün
  const label = (s: number) =>
    s === 0 ? tc("none") : s < 60 ? tc("seconds", { n: s }) : s < 3600 ? tc("minutes", { n: s / 60 }) : s < 86400 ? tc("hours", { n: s / 3600 }) : tc("days", { n: s / 86400 });
  const opt = (s: number) => ({ value: s, label: label(s) });

  const labels = {
    name: t("name"),
    type: t("type"),
    target: t("target"),
    targetHelp: t("targetHelp"),
    keyword: t("keyword"),
    interval: t("interval"),
    period: t("period"),
    grace: t("grace"),
    graceHelp: t("graceHelp"),
    heartbeatHelp: t("heartbeatHelp"),
    optional: tc("optional"),
    create: t("create"),
    types: Object.fromEntries(TYPES.map((x) => [x, t(`types.${x}`)])),
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("usage", { used: monitors.length, limit: limits.monitors })}</p>
        </div>
        <Modal trigger={t("new")} title={t("new")} closeLabel={tc("back")}>
          <MonitorForm
            action={createMonitorAction}
            labels={labels}
            intervals={INTERVALS.filter((i) => i >= limits.minInterval).map(opt)}
            periods={PERIODS.filter((p) => p >= limits.minInterval).map(opt)}
            graces={GRACES.map(opt)}
            defaultInterval={Math.max(limits.minInterval, 180)}
          />
        </Modal>
      </div>

      <Flash error={searchParams.error} ok={searchParams.ok} />

      {monitors.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {monitors.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <Link href={`/dashboard/monitors/${m.id}`} className="font-medium underline">
                  {m.name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {m.type === "HEARTBEAT" ? t("types.HEARTBEAT") : m.url} · {label(m.interval)}
                </p>
              </div>
              <StatusBadge status={statusOf(m)} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
