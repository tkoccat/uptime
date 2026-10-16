import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Docker/Dokploy sağlık kontrolü: süreç ayakta mı (bağımlılıklara bağlı değildir)
export function GET() {
  return NextResponse.json({ status: "ok" });
}
