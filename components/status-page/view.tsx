import type { StatusMonitor, StatusPageData } from "@/lib/status-page/data";
import { statusStrings } from "@/lib/status-page/strings";
import { company } from "@/lib/company";

// Bir günün rengi: kesinti yok = yeşil, kısmi = sarı, ağırlıklı kesinti = kırmızı, veri yok = gri
function dayClass(d: { up: number; down: number }): string {
  const total = d.up + d.down;
  if (total === 0) return "bg-muted";
  const ratio = d.up / total;
  if (ratio >= 0.999) return "bg-emerald-500";
  if (ratio >= 0.95) return "bg-amber-400";
  return "bg-red-500";
}

function Bars({ monitor, label }: { monitor: StatusMonitor; label: string }) {
  return (
    <div role="img" aria-label={label} className="flex h-8 gap-px">
      {monitor.days.map((d) => {
        const total = d.up + d.down;
        const pct = total ? ((d.up / total) * 100).toFixed(2) : "–";
        return <div key={d.day} title={`${d.day}: ${pct}%`} className={`min-w-0 flex-1 rounded-sm ${dayClass(d)}`} />;
      })}
    </div>
  );
}

export function StatusPageView({ data }: { data: StatusPageData }) {
  const s = statusStrings(data.locale);
  const anyDown = data.monitors.some((m) => m.isActive && m.isDown);
  const fmt = new Intl.DateTimeFormat(data.locale, { dateStyle: "medium", timeStyle: "short", timeZone: data.timezone });

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <h1 className="text-3xl font-bold">{data.title}</h1>

      <p
        role="status"
        className={`rounded-lg p-4 font-medium ${
          anyDown ? "bg-red-500/15 text-red-700 dark:text-red-400" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
        }`}
      >
        {anyDown ? s.someDown : s.allUp}
      </p>

      {data.monitors.length === 0 ? (
        <p className="text-muted-foreground">{s.noMonitors}</p>
      ) : (
        <ul className="space-y-6">
          {data.monitors.map((m) => (
            <li key={m.id} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{m.name}</span>
                <span className="text-sm text-muted-foreground">
                  {!m.isActive ? s.paused : m.isDown ? s.down : s.up}
                  {" · "}
                  {m.uptime === null ? s.noData : `${m.uptime.toFixed(2)}% ${s.uptime}`}
                </span>
              </div>
              <Bars monitor={m} label={`${m.name}: ${s.days90}`} />
              <p className="text-xs text-muted-foreground">{s.days90}</p>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{s.incidents}</h2>
        {data.incidents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{s.noIncidents}</p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {data.incidents.map((i) => (
              <li key={i.id} className="space-y-1 p-3">
                <p className="font-medium">
                  {i.monitorName} · {i.resolvedAt ? s.resolved : s.ongoing}
                </p>
                <p className="text-muted-foreground">
                  {fmt.format(i.startedAt)}
                  {i.resolvedAt ? ` → ${fmt.format(i.resolvedAt)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-muted-foreground">
        {s.poweredBy} {company.productName}
      </p>
    </main>
  );
}
