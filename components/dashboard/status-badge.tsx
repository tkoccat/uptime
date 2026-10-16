import { getTranslations } from "next-intl/server";

export type DisplayStatus = "up" | "down" | "pending" | "maintenance" | "unknown" | "paused";

const STYLES: Record<DisplayStatus, string> = {
  up: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  down: "bg-red-500/15 text-red-700 dark:text-red-400",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  maintenance: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  unknown: "bg-muted text-muted-foreground",
  paused: "bg-muted text-muted-foreground",
};

// Renk tek başına anlam taşımaz: durum her zaman metinle de yazılır
export async function StatusBadge({ status }: { status: DisplayStatus }) {
  const t = await getTranslations("Dash.status");
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>{t(status)}</span>;
}
