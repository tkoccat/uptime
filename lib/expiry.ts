import tls from "node:tls";
import { prisma } from "./prisma";
import { assertPublicUrl } from "./security/url-guard";

// SSL sertifikası ve alan adı bitiş tarihleri: Uptime Kuma'nın ayrıntı sayfasındaki "Sertifika" / "Domain Exp." kutuları.
// Sertifika, hedefe doğrudan TLS bağlantısıyla; alan adı, RDAP (WHOIS'in JSON karşılığı) ile okunur.
// Sonuçlar Monitor kaydında saklanır ve en çok 12 saatte bir tembel yenilenir.

const STALE_MS = 12 * 3600_000;
// Sorgu en fazla bu kadar bekler: ayrıntı sayfasının açılışını geciktirmesin
const BUDGET_MS = 4_000;

// Yaygın iki parçalı son ekler (tam bir Public Suffix listesi yerine kısa bir liste yeterli; bulunamazsa "–" gösterilir)
const TWO_PART = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "com.tr", "net.tr", "org.tr", "gen.tr", "edu.tr", "gov.tr", "com.au", "net.au", "org.au",
  "co.nz", "co.za", "co.jp", "ne.jp", "or.jp", "com.br", "com.cn", "com.mx", "com.ar", "co.in", "co.kr", "com.sg", "com.hk", "com.tw", "co.il",
]);

/** "api.shop.example.co.uk" -> "example.co.uk". IP adresi ve tek etiketli adlar için null. */
export function registrableDomain(host: string): string | null {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (!/^[a-z0-9.-]+$/.test(h) || /^\d+(\.\d+){3}$/.test(h)) return null;
  const parts = h.split(".");
  if (parts.length < 2) return null;
  const last2 = parts.slice(-2).join(".");
  return TWO_PART.has(last2) && parts.length >= 3 ? parts.slice(-3).join(".") : last2;
}

/** RDAP yanıtından "expiration" olayının tarihini okur. */
export function parseRdapExpiry(json: unknown): Date | null {
  const events = (json as { events?: { eventAction?: string; eventDate?: string }[] } | null)?.events;
  const e = events?.find((x) => x.eventAction === "expiration");
  const d = e?.eventDate ? new Date(e.eventDate) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

type Bootstrap = { services?: [string[], string[]][] };

// IANA'nın RDAP sunucu listesi (Uptime Kuma da aynısını kullanır): uzantı -> kayıt sunucusu. Günde bir yenilenir.
let bootstrap: { at: number; map: Map<string, string> } | null = null;

/** Bootstrap JSON'undan uzantı -> https RDAP sunucusu tablosu çıkarır. */
export function parseBootstrap(json: Bootstrap): Map<string, string> {
  const map = new Map<string, string>();
  for (const [tlds, urls] of json.services ?? []) {
    const url = urls.find((u) => u.startsWith("https://")) ?? urls[0];
    if (!url) continue;
    for (const tld of tlds) map.set(tld.toLowerCase(), url.endsWith("/") ? url : `${url}/`);
  }
  return map;
}

async function rdapServerFor(tld: string): Promise<string | null> {
  if (!bootstrap || Date.now() - bootstrap.at > 24 * 3600_000) {
    try {
      const res = await fetch("https://data.iana.org/rdap/dns.json", { signal: AbortSignal.timeout(BUDGET_MS) });
      if (res.ok) bootstrap = { at: Date.now(), map: parseBootstrap((await res.json()) as Bootstrap) };
    } catch {
      // Liste alınamazsa eski kopya (varsa) kullanılır
    }
  }
  return bootstrap?.map.get(tld) ?? null;
}

export async function getDomainExpiry(host: string): Promise<Date | null> {
  const domain = registrableDomain(host);
  if (!domain) return null;
  const tld = domain.split(".").pop()!;
  try {
    // Sunucu IANA listesinden gelir (kullanıcı girdisi değil); sorguya yalnızca doğrulanmış alan adı eklenir
    const server = await rdapServerFor(tld);
    if (!server) return null;
    const res = await fetch(`${server}domain/${domain}`, {
      headers: { Accept: "application/rdap+json, application/json" },
      signal: AbortSignal.timeout(BUDGET_MS),
    });
    return res.ok ? parseRdapExpiry(await res.json()) : null;
  } catch {
    return null;
  }
}

/** HTTPS hedefinin sertifikasının bitiş tarihi; HTTPS değilse veya ulaşılamazsa null. */
export async function getCertExpiry(url: string): Promise<Date | null> {
  let u: URL;
  try {
    u = await assertPublicUrl(url); // iç ağa bağlantı denenemez
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;

  return new Promise((resolve) => {
    const socket = tls.connect({ host: u.hostname, port: Number(u.port) || 443, servername: u.hostname, rejectUnauthorized: false, timeout: BUDGET_MS }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      const d = cert?.valid_to ? new Date(cert.valid_to) : null;
      resolve(d && !Number.isNaN(d.getTime()) ? d : null);
    });
    socket.on("error", () => resolve(null));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(null);
    });
  });
}

export type ExpiryInfo = { cert: Date | null; domain: Date | null };

/**
 * Monitörün bitiş bilgilerini döner; kayıt 12 saatten eskiyse (veya hiç yoksa) yeniler.
 * Yalnızca HTTP/KEYWORD monitörleri için anlamlıdır.
 */
export async function getExpiryInfo(monitor: {
  id: string;
  type: string;
  url: string;
  certExpiresAt: Date | null;
  domainExpiresAt: Date | null;
  expiryCheckedAt: Date | null;
}): Promise<ExpiryInfo> {
  if (monitor.type !== "HTTP" && monitor.type !== "KEYWORD") return { cert: null, domain: null };
  const cached: ExpiryInfo = { cert: monitor.certExpiresAt, domain: monitor.domainExpiresAt };
  // Her iki bilgi de varsa 12 saat; eksik varsa (geçici hata olabilir) 5 dakika sonra tekrar denenir
  const ttl = cached.cert && cached.domain ? STALE_MS : 5 * 60_000;
  if (monitor.expiryCheckedAt && Date.now() - monitor.expiryCheckedAt.getTime() < ttl) return cached;

  let host: string;
  try {
    host = new URL(monitor.url).hostname;
  } catch {
    return cached;
  }

  const [cert, domain] = await Promise.all([getCertExpiry(monitor.url), getDomainExpiry(host)]);
  // Geçici bir hata eski değeri silmesin: yalnızca bulunan değerler yazılır
  const next: ExpiryInfo = { cert: cert ?? cached.cert, domain: domain ?? cached.domain };
  await prisma.monitor
    .update({ where: { id: monitor.id }, data: { certExpiresAt: next.cert, domainExpiresAt: next.domain, expiryCheckedAt: new Date() } })
    .catch(() => undefined);
  return next;
}

/** Bugünden bitişe kalan gün (geçmişse negatif). */
export function daysUntil(date: Date, now: number = Date.now()): number {
  return Math.ceil((date.getTime() - now) / 86_400_000);
}
