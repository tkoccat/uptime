import { prisma } from "../prisma";

export type DayBar = { day: string; up: number; down: number };

export type StatusMonitor = {
  id: string;
  name: string;
  isActive: boolean;
  isDown: boolean;
  // Son 90 günün her günü için sayaçlar (eskiden yeniye, eksik günler boş)
  days: DayBar[];
  // Son 90 günün toplam uptime yüzdesi (veri yoksa null)
  uptime: number | null;
};

export type StatusIncident = { id: string; monitorName: string; startedAt: Date; resolvedAt: Date | null; message: string | null };

export type StatusPageData = {
  title: string;
  locale: string;
  timezone: string;
  monitors: StatusMonitor[];
  incidents: StatusIncident[];
};

const DAYS = 90;

function lastDays(n: number): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = n - 1; i >= 0; i--) out.push(new Date(now - i * 86_400_000).toISOString().slice(0, 10));
  return out;
}

/** Herkese açık durum sayfası verisi. Yalnızca sayfaya bağlı monitörler ve bunların özetleri döner. */
export async function loadStatusPage(where: { slug: string } | { customDomain: string }): Promise<StatusPageData | null> {
  const page = await prisma.statusPage.findFirst({
    where: { ...where, isPublic: true },
    include: { monitors: true, user: { select: { locale: true, timezone: true } } },
  });
  if (!page) return null;

  const monitorIds = page.monitors.map((m) => m.id);
  const since = new Date(Date.now() - DAYS * 86_400_000);

  const [daily, incidents, open] = await Promise.all([
    prisma.monitorDaily.findMany({ where: { monitorId: { in: monitorIds }, day: { gte: since } } }),
    prisma.incident.findMany({
      where: { monitorId: { in: monitorIds }, startedAt: { gte: since } },
      include: { monitor: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
      take: 30,
    }),
    prisma.incident.findMany({ where: { monitorId: { in: monitorIds }, resolvedAt: null }, select: { monitorId: true } }),
  ]);

  const downIds = new Set(open.map((i) => i.monitorId));
  const days = lastDays(DAYS);

  const monitors: StatusMonitor[] = page.monitors.map((m) => {
    const mine = new Map(daily.filter((d) => d.monitorId === m.id).map((d) => [d.day.toISOString().slice(0, 10), d]));
    const bars = days.map((day) => ({ day, up: mine.get(day)?.up ?? 0, down: mine.get(day)?.down ?? 0 }));
    const up = bars.reduce((a, b) => a + b.up, 0);
    const down = bars.reduce((a, b) => a + b.down, 0);
    return {
      id: m.id,
      name: m.name,
      isActive: m.isActive,
      isDown: downIds.has(m.id),
      days: bars,
      uptime: up + down > 0 ? (up / (up + down)) * 100 : null,
    };
  });

  return {
    title: (page.config as { title?: string } | null)?.title ?? page.slug,
    locale: page.user.locale,
    timezone: page.user.timezone,
    monitors,
    incidents: incidents.map((i) => ({
      id: i.id,
      monitorName: i.monitor.name,
      startedAt: i.startedAt,
      resolvedAt: i.resolvedAt,
      message: i.message,
    })),
  };
}
