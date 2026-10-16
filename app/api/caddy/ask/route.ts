import { resolveCname, resolve4 } from "node:dns/promises";
import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Caddy on-demand TLS "ask" uç noktası: sertifika yalnızca bizim bildiğimiz alan adları için verilir.
// Böylece kimse rastgele alan adlarını sunucumuza yönlendirip sertifika üretimini tetikleyemez.
// Caddyfile: on_demand_tls { ask http://nextjs-app:3000/api/caddy/ask?secret=... }

async function pointsToUs(domain: string, base: string): Promise<boolean> {
  const target = `cname.${base}`;
  try {
    const cnames = await resolveCname(domain);
    if (cnames.some((c) => c.replace(/\.$/, "").toLowerCase() === target)) return true;
  } catch {
    /* CNAME yok: A kaydını dene */
  }
  const ip = process.env.STATUS_SERVER_IP;
  if (!ip) return false;
  try {
    return (await resolve4(domain)).includes(ip);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const expected = process.env.CADDY_ASK_SECRET ?? "";
  if (!expected || !safeEqual(request.nextUrl.searchParams.get("secret") ?? "", expected)) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const domain = (request.nextUrl.searchParams.get("domain") ?? "").toLowerCase();
  const base = (process.env.NEXT_PUBLIC_STATUS_BASE_DOMAIN ?? "").toLowerCase();
  if (!domain || !base) return new NextResponse("bad request", { status: 400 });

  // <slug>.siten.com: kayıtlı ve herkese açık bir durum sayfası varsa onayla
  const suffix = `.${base}`;
  if (domain.endsWith(suffix)) {
    const slug = domain.slice(0, -suffix.length);
    if (!slug || slug.includes(".")) return new NextResponse("no", { status: 404 });
    const page = await prisma.statusPage.findFirst({ where: { slug, isPublic: true }, select: { id: true } });
    return new NextResponse(page ? "ok" : "no", { status: page ? 200 : 404 });
  }

  // Özel alan adı: kayıtlı olmalı ve DNS bize işaret etmeli (sahiplik kanıtı)
  const page = await prisma.statusPage.findFirst({ where: { customDomain: domain, isPublic: true } });
  if (!page) return new NextResponse("no", { status: 404 });
  if (!(await pointsToUs(domain, base))) return new NextResponse("dns", { status: 404 });

  if (!page.customDomainVerified) {
    await prisma.statusPage.update({ where: { id: page.id }, data: { customDomainVerified: true } });
  }
  return new NextResponse("ok", { status: 200 });
}
