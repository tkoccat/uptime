// Ürün önizlemesi: gerçek veri değil, arayüzü anlatan çizimdir (ekran okuyuculardan gizlenir).
type Row = { name: string; kind: string; state: "up" | "down"; uptime: string; days: ("ok" | "warn" | "bad")[] };

// Deterministik çubuk desenleri (rastgele değil: sunucu ve istemci aynı çıktıyı üretir)
const bars = (bad: number[] = [], warn: number[] = []): Row["days"] =>
  Array.from({ length: 30 }, (_, i) => (bad.includes(i) ? "bad" : warn.includes(i) ? "warn" : "ok"));

const ROWS: Row[] = [
  { name: "example.com", kind: "HTTPS", state: "up", uptime: "99.98%", days: bars([], [11]) },
  { name: "api.example.com", kind: "HTTPS", state: "up", uptime: "99.95%", days: bars([], [4, 21]) },
  { name: "Nightly backup", kind: "Heartbeat", state: "up", uptime: "100%", days: bars() },
  { name: "checkout.example.com", kind: "HTTPS", state: "down", uptime: "99.41%", days: bars([29], [8, 17]) },
];

const COLOR = { ok: "bg-emerald-500", warn: "bg-amber-400", bad: "bg-red-500" } as const;

export function HeroPreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-xl">
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-primary/10 blur-2xl" />
      <div className="overflow-hidden rounded-xl border bg-card shadow-xl">
        <div className="flex items-center gap-2 border-b bg-secondary/60 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-3 text-xs font-medium text-muted-foreground">Monitors</span>
        </div>
        <ul className="divide-y">
          {ROWS.map((r) => (
            <li key={r.name} className="space-y-2 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.state === "up" ? "bg-emerald-500" : "animate-pulse bg-red-500"}`} />
                  <span className="truncate text-sm font-medium">{r.name}</span>
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{r.kind}</span>
                </div>
                <span className={`text-xs font-medium ${r.state === "up" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {r.state === "up" ? "Up" : "Down"} · {r.uptime}
                </span>
              </div>
              <div className="flex h-5 gap-[2px]">
                {r.days.map((d, i) => (
                  <span key={i} className={`flex-1 rounded-[2px] ${COLOR[d]}`} />
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
