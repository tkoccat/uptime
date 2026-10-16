import { getTranslations, setRequestLocale } from "next-intl/server";
import { Flash } from "@/components/dashboard/flash";
import { MonitorForm } from "@/components/dashboard/monitor-form";
import { MonitorList, type DisplayStatus, type MonitorRow } from "@/components/dashboard/monitor-list";
import { Modal } from "@/components/dashboard/modal";
import { requireUser } from "@/lib/auth/current-user";
import { getLimits } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { getMonitorSummaries } from "@/lib/uptimeKuma";
import { createMonitorAction, toggleMonitorAction } from "../actions";

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

  const now = new Date();
  const limits = await getLimits(user.plan);
  const [monitors, open, inMaintenance, summaries] = await Promise.all([
    prisma.monitor.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.incident.findMany({ where: { resolvedAt: null, monitor: { userId: user.id } }, select: { monitorId: true } }),
    prisma.monitor.findMany({
      where: { userId: user.id, maintenances: { some: { startsAt: { lte: now }, endsAt: { gt: now } } } },
      select: { id: true },
    }),
    getMonitorSummaries(user.id).catch(() => new Map()),
  ]);
  const downIds = new Set(open.map((i) => i.monitorId));
  const maintIds = new Set(inMaintenance.map((m) => m.id));

  // Süre etiketi: saniye / dakika / saat / gün
  const label = (s: number) =>
    s === 0 ? tc("none") : s < 60 ? tc("seconds", { n: s }) : s < 3600 ? tc("minutes", { n: s / 60 }) : s < 86400 ? tc("hours", { n: s / 3600 }) : tc("days", { n: s / 86400 });
  const opt = (s: number) => ({ value: s, label: label(s) });

  const rows: MonitorRow[] = monitors.map((m) => {
    const s = summaries.get(m.id);
    const beats = s?.beats ?? [];
    const last = beats[beats.length - 1];
    const status: DisplayStatus = !m.isActive
      ? "paused"
      : maintIds.has(m.id)
        ? "maintenance"
        : downIds.has(m.id) || last?.status === "down"
          ? "down"
          : (last?.status ?? "pending");
    return {
      id: m.id,
      name: m.name,
      type: m.type,
      target: m.type === "HEARTBEAT" ? t("types.HEARTBEAT") : m.url,
      intervalLabel: label(m.interval),
      status,
      isActive: m.isActive,
      tags: m.tags,
      beats,
      lastPing: [...beats].reverse().find((b) => b.ping !== null)?.ping ?? null,
      uptime30d: s?.uptime30d ?? null,
    };
  });

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
            intervals={INTERVALS.filter((i) => i >= limits.minInterval).map(opt)}
            periods={PERIODS.filter((p) => p >= limits.minInterval).map(opt)}
            graces={GRACES.map(opt)}
            defaultInterval={Math.max(limits.minInterval, 180)}
          />
        </Modal>
      </div>

      <Flash error={searchParams.error} ok={searchParams.ok} />

      {monitors.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : <MonitorList rows={rows} toggleAction={toggleMonitorAction} />}
    </>
  );
}
