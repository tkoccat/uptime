import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Flash } from "@/components/dashboard/flash";
import { MonitorForm } from "@/components/dashboard/monitor-form";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { readOptions } from "@/lib/monitor-options";
import { getLimits } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { updateMonitorAction } from "../../../actions";

const INTERVALS = [30, 60, 120, 180, 300, 600, 900, 1800, 3600];
const PERIODS = [60, 300, 900, 1800, 3600, 21600, 43200, 86400, 604800];
const GRACES = [0, 60, 300, 900, 1800, 3600, 21600, 86400];

export default async function EditMonitorPage({
  params: { locale, id },
  searchParams,
}: {
  params: { locale: string; id: string };
  searchParams: { error?: string };
}) {
  setRequestLocale(locale);
  const user = await requireUser();
  const t = await getTranslations("Dash.monitors");
  const tc = await getTranslations("Dash.common");

  // userId koşulu: başkasının monitörü 404 döner
  const m = await prisma.monitor.findFirst({ where: { id, userId: user.id } });
  if (!m) notFound();
  const limits = await getLimits(user.plan);

  const label = (s: number) =>
    s === 0 ? tc("none") : s < 60 ? tc("seconds", { n: s }) : s < 3600 ? tc("minutes", { n: s / 60 }) : s < 86400 ? tc("hours", { n: s / 3600 }) : tc("days", { n: s / 86400 });
  const opt = (s: number) => ({ value: s, label: label(s) });
  // Kayıtlı değer plan alt sınırının altındaysa (plan düşürülmüş olabilir) yine de listede görünür
  const withCurrent = (list: number[]) => [...new Set([...list, m.interval])].sort((a, b) => a - b);

  return (
    <>
      <div className="space-y-1">
        <Link href={`/dashboard/monitors/${m.id}`} className="text-sm underline">
          ← {m.name}
        </Link>
        <h1 className="text-2xl font-semibold">{t("editTitle")}</h1>
      </div>
      <Flash error={searchParams.error} />
      <div className="max-w-2xl rounded-lg border p-4">
        <MonitorForm
          action={updateMonitorAction}
          intervals={withCurrent(INTERVALS.filter((i) => i >= limits.minInterval)).map(opt)}
          periods={withCurrent(PERIODS.filter((p) => p >= limits.minInterval)).map(opt)}
          graces={GRACES.map(opt)}
          defaultInterval={m.interval}
          initial={{
            id: m.id,
            name: m.name,
            type: m.type,
            url: m.type === "HEARTBEAT" ? "" : m.url,
            keyword: readOptions(m.options).keyword,
            interval: m.interval,
            grace: m.graceSeconds,
            description: m.description ?? "",
            tags: m.tags.join(", "),
            options: readOptions(m.options),
          }}
        />
      </div>
    </>
  );
}
