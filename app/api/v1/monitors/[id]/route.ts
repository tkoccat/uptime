import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";
import { apiError } from "@/lib/api-response";
import { deleteMonitor, getMonitorStatus } from "@/lib/uptimeKuma";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticateApiKey(request.headers.get("authorization"));
    const status = await getMonitorStatus(user.id, params.id);
    return NextResponse.json({ data: { id: params.id, ...status } });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticateApiKey(request.headers.get("authorization"));
    await deleteMonitor(user.id, params.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return apiError(err);
  }
}
