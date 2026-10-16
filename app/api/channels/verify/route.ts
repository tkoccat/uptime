import { NextResponse, type NextRequest } from "next/server";
import { verifyToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// E-posta kanalı doğrulama bağlantısı (imzalı, 7 gün geçerli). Oturum gerektirmez:
// bağlantıyı alabilmek adrese erişimi kanıtlar.
export async function GET(request: NextRequest) {
  const channelId = verifyToken(request.nextUrl.searchParams.get("token") ?? "");
  const base = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  if (!channelId) return NextResponse.redirect(`${base}/dashboard/notifications?verify=invalid`);

  const res = await prisma.notificationChannel.updateMany({
    where: { id: channelId, type: "EMAIL" },
    data: { isVerified: true },
  });
  return NextResponse.redirect(`${base}/dashboard/notifications?verify=${res.count ? "ok" : "invalid"}`);
}
