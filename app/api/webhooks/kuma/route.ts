import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { safeEqual } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { enqueue } from "@/lib/queue";

export const runtime = "nodejs";

// Uptime Kuma "webhook" bildirimi (JSON): { heartbeat: { status, time, msg }, monitor: { id }, msg }
const payloadSchema = z.object({
  heartbeat: z.object({ status: z.number(), time: z.string().optional(), msg: z.string().optional() }),
  monitor: z.object({ id: z.number() }),
});

export async function POST(request: NextRequest) {
  const expected = process.env.KUMA_WEBHOOK_SECRET ?? "";
  const given = request.nextUrl.searchParams.get("secret") ?? "";
  if (!expected || !safeEqual(given, expected)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad payload" }, { status: 400 });

  const { heartbeat, monitor } = parsed.data;
  // Yalnızca down (0) ve up (1) olayları; pending/maintenance için bildirim yok
  if (heartbeat.status !== 0 && heartbeat.status !== 1) return NextResponse.json({ ok: true, ignored: true });

  const row = await prisma.monitor.findUnique({
    where: { uptimeKumaMonitorId: monitor.id },
    select: { id: true },
  });
  if (!row) return NextResponse.json({ ok: true, ignored: true }); // bilinmeyen monitör

  // Kuma zamanı UTC "YYYY-MM-DD HH:mm:ss.SSS" biçimindedir
  const time = heartbeat.time ? new Date(`${heartbeat.time.replace(" ", "T")}Z`) : new Date();
  await enqueue("alert", {
    monitorId: row.id,
    kind: heartbeat.status === 0 ? "down" : "up",
    message: heartbeat.msg,
    time: (Number.isNaN(time.getTime()) ? new Date() : time).toISOString(),
  });
  return NextResponse.json({ ok: true });
}
