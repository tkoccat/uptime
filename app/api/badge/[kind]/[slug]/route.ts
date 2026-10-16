import { NextResponse, type NextRequest } from "next/server";
import { statusBadge, uptimeBadge } from "@/lib/badge";
import { loadStatusPage } from "@/lib/status-page/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// /api/badge/status/<slug>.svg  ve  /api/badge/uptime/<slug>.svg
// Yalnızca herkese açık durum sayfalarının verisini gösterir (loadStatusPage isPublic koşulunu uygular).
export async function GET(_req: NextRequest, { params }: { params: { kind: string; slug: string } }) {
  const slug = params.slug.replace(/\.svg$/i, "").toLowerCase();
  if (!/^[a-z0-9-]{3,32}$/.test(slug) || !["status", "uptime"].includes(params.kind)) {
    return new NextResponse("not found", { status: 404 });
  }

  let data = null;
  try {
    data = await loadStatusPage({ slug });
  } catch {
    /* veritabanı yoksa gri "unknown" rozeti döner */
  }
  const svg = params.kind === "status" ? statusBadge(data) : uptimeBadge(data);
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Rozet sık sık yenilenir ama her istek veritabanına gitmesin
      "Cache-Control": "public, max-age=60, s-maxage=60",
    },
  });
}
