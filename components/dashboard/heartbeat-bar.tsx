import type { Heartbeat } from "@/lib/uptime-kuma/types";

const COLORS: Record<Heartbeat["status"], string> = {
  up: "bg-emerald-500",
  down: "bg-red-500",
  pending: "bg-amber-500",
  maintenance: "bg-blue-500",
};

// Uptime Kuma'daki gibi son kontrolleri renkli çubuklarla gösterir (eskiden yeniye; eksik yerler gri).
// Renk tek başına anlam taşımadığından her çubuğun başlığında durum ve yanıt süresi yazılır.
export function HeartbeatBar({ beats, size = 40, label, className = "" }: { beats: Heartbeat[]; size?: number; label: string; className?: string }) {
  const shown = beats.slice(-size);
  const empty = Array.from({ length: Math.max(0, size - shown.length) });

  return (
    <div role="img" aria-label={label} className={`flex h-6 items-stretch gap-[2px] ${className}`}>
      {empty.map((_, i) => (
        <span key={`e${i}`} className="w-1.5 rounded-sm bg-muted" />
      ))}
      {shown.map((b) => (
        <span
          key={b.time}
          title={`${b.status}${b.ping !== null ? ` · ${b.ping} ms` : ""} · ${b.time.slice(0, 16).replace("T", " ")} UTC`}
          className={`w-1.5 rounded-sm ${COLORS[b.status]}`}
        />
      ))}
    </div>
  );
}
