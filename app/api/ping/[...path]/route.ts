import { NextResponse, type NextRequest } from "next/server";
import { handlePing, parsePingPath } from "@/lib/heartbeat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Heartbeat ping uç noktası: GET, POST ve HEAD kabul edilir (curl, wget, cron, GitHub Actions vb.)
//   /api/ping/<anahtar>        -> iş başarıyla çalıştı
//   /api/ping/<anahtar>/fail   -> iş başarısız oldu (hemen uyarı)
// İsteğe bağlı mesaj: ?msg=... veya POST gövdesi (ilk 200 karakter)

async function respond(request: NextRequest, { params }: { params: { path: string[] } }) {
  const parsed = parsePingPath(params.path);
  if (!parsed) return new NextResponse("not found", { status: 404 });

  let message = request.nextUrl.searchParams.get("msg") ?? undefined;
  if (!message && request.method === "POST") {
    message = (await request.text().catch(() => "")).slice(0, 200) || undefined;
  }

  const result = await handlePing({ ...parsed, message });
  return new NextResponse(request.method === "HEAD" ? null : result.body, {
    status: result.status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...(result.retryAfterSec ? { "Retry-After": String(result.retryAfterSec) } : {}),
    },
  });
}

export const GET = respond;
export const POST = respond;
export const HEAD = respond;
