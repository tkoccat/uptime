// Bağımlılıksız SVG çizgi grafiği (yanıt süresi). Veri yoksa boş bir çizgi gösterir.
export function Sparkline({ values, label }: { values: (number | null)[]; label: string }) {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) {
    return <div role="img" aria-label={label} className="h-16 rounded-md border border-dashed" />;
  }
  const max = Math.max(...nums, 1);
  const w = 600;
  const h = 64;
  const step = w / (values.length - 1);
  const points = values
    .map((v, i) => (v === null ? null : `${(i * step).toFixed(1)},${(h - (v / max) * (h - 4) - 2).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");

  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${w} ${h}`} className="h-16 w-full text-primary" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
