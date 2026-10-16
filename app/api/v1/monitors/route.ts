import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { createMonitor } from "@/lib/uptimeKuma";

export const runtime = "nodejs";

type PublicInput = {
  id: string;
  name: string;
  url: string;
  type: string;
  interval: number;
  isActive: boolean;
  createdAt: Date;
  pingToken?: string | null;
};

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

// Heartbeat monitörlerinde işin çağıracağı ping adresi de döner
const publicMonitor = (m: PublicInput) => ({
  id: m.id,
  name: m.name,
  url: m.type === "HEARTBEAT" ? null : m.url,
  type: m.type,
  interval: m.interval,
  active: m.isActive,
  createdAt: m.createdAt,
  ...(m.type === "HEARTBEAT" && m.pingToken ? { pingUrl: `${appUrl()}/api/ping/${m.pingToken}` } : {}),
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
