import { getTranslations, setRequestLocale } from "next-intl/server";
import { Flash } from "@/components/dashboard/flash";
import { Modal } from "@/components/dashboard/modal";
import { StatusBadge, type DisplayStatus } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { getLimits } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { createMonitorAction } from "../actions";

const TYPES = ["HTTP", "KEYWORD", "PING", "PORT", "DNS"] as const;
const INTERVALS = [30, 60, 120, 180, 300, 600, 900, 1800, 3600];

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

  // Plan için izin verilen aralıklar
  const intervals = INTERVALS.filter((i) => i >= limits.minInterval);
  const label = (s: number) => (s < 60 ? tc("seconds", { n: s }) : tc("minutes", { n: s / 60 }));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("usage", { used: monitors.length, limit: limits.monitors })}</p>
        </div>
        <Modal trigger={t("new")} title={t("new")} closeLabel={tc("back")}>
          <form action={createMonitorAction} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="name">{t("name")}</Label>
              <Input id="name" name="name" maxLength={100} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="type">{t("type")}</Label>
              <select id="type" name="type" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {TYPES.map((x) => (
                  <option key={x} value={x}>
                    {t(`types.${x}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="url">{t("target")}</Label>
              <Input id="url" name="url" required />
              <p className="text-xs text-muted-foreground">{t("targetHelp")}</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="keyword">
                {t("keyword")} ({tc("optional")})
              </Label>
              <Input id="keyword" name="keyword" maxLength={200} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="interval">{t("interval")}</Label>
              <select
                id="interval"
                name="interval"
                defaultValue={String(Math.max(limits.minInterval, 180))}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {intervals.map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" className="w-full">
              {t("create")}
            </Button>
          </form>
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
                  {m.url} · {label(m.interval)}
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
