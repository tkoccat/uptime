import type { ChartPoint } from "@/lib/uptimeKuma";

const W = 640;
const H = 200;
const PAD = { l: 44, r: 8, t: 8, b: 22 };

// Yuvarlak, "güzel" üst sınır: 87 -> 100, 430 -> 500
function niceMax(v: number): number {
  if (v <= 10) return 10;
  const pow = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / pow) * pow;
}

// Bağımlılıksız SVG yanıt süresi grafiği: alan + çizgi, eksenler ve çöküş bantları (kırmızı).
// Veri boşluğu (ping yok) çizgiyi böler; çöküş dilimleri dikey kırmızı bantla gösterilir.
export function ResponseChart({
  points,
  label,
  formatX,
  emptyText,
}: {
  points: ChartPoint[];
  label: string;
  formatX: (t: number) => string;
  emptyText: string;
}) {
  const pings = points.map((p) => p.ping).filter((v): v is number => v !== null);
  if (pings.length < 2 && !points.some((p) => p.down)) {
    return (
      <div role="img" aria-label={label} className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  const max = niceMax(Math.max(...pings, 1));
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (points.length <= 1 ? 0 : (i / (points.length - 1)) * iw);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  const bw = Math.max(2, iw / points.length);

  // Ardışık ping'li noktalar ayrı çizgi parçaları oluşturur
  const runs: { x: number; y: number }[][] = [];
  let run: { x: number; y: number }[] = [];
  points.forEach((p, i) => {
    if (p.ping === null) {
      if (run.length) runs.push(run);
      run = [];
    } else run.push({ x: x(i), y: y(p.ping) });
  });
  if (run.length) runs.push(run);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const xLabels = [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full text-primary">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity="0.1" />
          <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.6">
            {v}
          </text>
        </g>
      ))}
      <text x={4} y={PAD.t + 8} fontSize="10" fill="currentColor" fillOpacity="0.6">
        ms
      </text>

      {points.map((p, i) =>
        p.down ? <rect key={`d${i}`} x={x(i) - bw / 2} y={PAD.t} width={bw} height={ih} fill="#ef4444" fillOpacity="0.25" /> : null
      )}

      {runs.map((r, i) => {
        const line = r.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
        const area = `${r[0].x.toFixed(1)},${PAD.t + ih} ${line} ${r[r.length - 1].x.toFixed(1)},${PAD.t + ih}`;
        return (
          <g key={i}>
            {r.length > 1 && <polygon points={area} fill="currentColor" fillOpacity="0.12" />}
            {r.length > 1 ? <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /> : <circle cx={r[0].x} cy={r[0].y} r="2" fill="currentColor" />}
          </g>
        );
      })}

      {xLabels.map((i, k) => (
        <text key={i} x={x(i)} y={H - 6} textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"} fontSize="10" fill="currentColor" fillOpacity="0.6">
          {formatX(points[i].t)}
        </text>
      ))}
    </svg>
  );
}
