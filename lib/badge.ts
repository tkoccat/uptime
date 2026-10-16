import type { StatusPageData } from "./status-page/data";

// Durum rozetleri (SVG): README, panolar ve durum sayfalarına gömülür. Veri zaten herkese açık durum sayfasındakidir.

export type BadgeColor = "green" | "red" | "amber" | "grey";

const COLORS: Record<BadgeColor, string> = { green: "#1f9d55", red: "#d64545", amber: "#d9822b", grey: "#7a8699" };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Karakter başına yaklaşık genişlik (Verdana 11px); gerçek ölçüm gerekmeden okunaklı rozet için yeterli
const textWidth = (s: string) => Math.round(s.length * 6.6 + 10);

export function renderBadge(label: string, value: string, color: BadgeColor): string {
  const lw = textWidth(label);
  const vw = textWidth(value);
  const w = lw + vw;
  const l = esc(label);
  const v = esc(value);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${l}: ${v}">
<title>${l}: ${v}</title>
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#3a4556"/><rect x="${lw}" width="${vw}" height="20" fill="${COLORS[color]}"/><rect width="${w}" height="20" fill="url(#s)"/></g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${lw / 2}" y="14">${l}</text><text x="${lw + vw / 2}" y="14">${v}</text></g></svg>`;
}

/** Durum sayfası verisinden genel durum rozeti. */
export function statusBadge(data: StatusPageData | null): string {
  if (!data) return renderBadge("status", "unknown", "grey");
  const active = data.monitors.filter((m) => m.isActive);
  if (active.length === 0) return renderBadge("status", "no data", "grey");
  const down = active.filter((m) => m.isDown).length;
  if (down === 0) return renderBadge("status", "operational", "green");
  return renderBadge("status", down === active.length ? "major outage" : "partial outage", down === active.length ? "red" : "amber");
}

/** 90 günlük ortalama uptime rozeti (veri yoksa gri). */
export function uptimeBadge(data: StatusPageData | null): string {
  const values = (data?.monitors ?? []).map((m) => m.uptime).filter((u): u is number => u !== null);
  if (values.length === 0) return renderBadge("uptime 90d", "n/a", "grey");
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return renderBadge("uptime 90d", `${avg.toFixed(2)}%`, avg >= 99.9 ? "green" : avg >= 99 ? "amber" : "red");
}
