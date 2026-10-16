"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { HeartbeatBar } from "@/components/dashboard/heartbeat-bar";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Heartbeat } from "@/lib/uptime-kuma/types";

export type DisplayStatus = "up" | "down" | "pending" | "maintenance" | "unknown" | "paused";

export type MonitorRow = {
  id: string;
  name: string;
  type: string;
  target: string;
  intervalLabel: string;
  status: DisplayStatus;
  isActive: boolean;
  tags: string[];
  beats: Heartbeat[];
  lastPing: number | null;
  uptime30d: number | null;
};

const DOT: Record<DisplayStatus, string> = {
  up: "bg-emerald-500",
  down: "bg-red-500",
  pending: "bg-amber-500",
  maintenance: "bg-blue-500",
  unknown: "bg-muted-foreground/40",
  paused: "bg-muted-foreground/40",
};

const FILTERS = ["all", "up", "down", "paused"] as const;

// Arama, durum ve etiket süzgeçli, Uptime Kuma tarzı monitör listesi.
// Duraklat/başlat eylemi sunucu eylemi olarak dışarıdan verilir.
export function MonitorList({ rows, toggleAction }: { rows: MonitorRow[]; toggleAction: (fd: FormData) => void | Promise<void> }) {
  const t = useTranslations("Dash.monitors");
  const ts = useTranslations("Dash.status");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [tag, setTag] = useState("");

  const allTags = useMemo(() => [...new Set(rows.flatMap((r) => r.tags))].sort(), [rows]);
  const shown = rows.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (tag && !r.tags.includes(tag)) return false;
    const needle = q.trim().toLowerCase();
    return !needle || r.name.toLowerCase().includes(needle) || r.target.toLowerCase().includes(needle);
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          className="h-9 min-w-[12rem] flex-1 rounded-md border bg-background px-3 text-sm"
        />
        <div role="group" aria-label={t("filter")} className="flex gap-1">
          {FILTERS.map((f) => (
            <Button key={f} type="button" size="sm" variant={filter === f ? "default" : "outline"} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === "all" ? t("filterAll") : ts(f)}
            </Button>
          ))}
        </div>
        {allTags.length > 0 && (
          <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label={t("tags")} className="h-9 rounded-md border bg-background px-2 text-sm">
            <option value="">{t("allTags")}</option>
            {allTags.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">{t("noMatch")}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {shown.map((m) => (
            <li key={m.id} className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[m.status]}`} aria-hidden />
                  <Link href={`/dashboard/monitors/${m.id}`} className="truncate font-medium hover:underline">
                    {m.name}
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">{ts(m.status)}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {t(`types.${m.type}`)} · {m.target} · {m.intervalLabel}
                </p>
                {m.tags.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-1">
                    {m.tags.map((x) => (
                      <button key={x} type="button" onClick={() => setTag(x)} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] hover:bg-secondary/70">
                        {x}
                      </button>
                    ))}
                  </p>
                )}
              </div>

              <div className="hidden items-center gap-4 sm:flex">
                <HeartbeatBar beats={m.beats} size={30} label={t("recentChecks")} />
                <div className="w-20 text-right text-xs">
                  <p className="font-medium">{m.lastPing !== null ? `${m.lastPing} ms` : "–"}</p>
                  <p className="text-muted-foreground">{m.uptime30d !== null ? `${m.uptime30d.toFixed(2)}% · 30d` : "–"}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <form action={toggleAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="active" value={String(!m.isActive)} />
                  <input type="hidden" name="back" value="list" />
                  <Button type="submit" size="sm" variant="outline">
                    {m.isActive ? t("pause") : t("resume")}
                  </Button>
                </form>
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/dashboard/monitors/${m.id}/edit`}>{t("edit")}</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
