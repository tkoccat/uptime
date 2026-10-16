import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { createMonitor } from "@/lib/uptimeKuma";

export const runtime = "nodejs";

const publicMonitor = (m: { id: string; name: string; url: string; type: string; interval: number; isActive: boolean; createdAt: Date }) => ({
  id: m.id,
  name: m.name,
  url: m.url,
  type: m.type,
  interval: m.interval,
  active: m.isActive,
  createdAt: m.createdAt,
});

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateApiKey(request.headers.get("authorization"));
    const monitors = await prisma.monitor.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    return NextResponse.json({ data: monitors.map(publicMonitor) });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateApiKey(request.headers.get("authorization"));
    const body = await request.json().catch(() => null);
    const monitor = await createMonitor(user.id, body ?? {});
    return NextResponse.json({ data: publicMonitor(monitor) }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
