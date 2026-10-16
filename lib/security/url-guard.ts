import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class UnsafeTargetError extends Error {}

// Özel, loopback, link-local ve rezerve adresler: kullanıcı bunları izleterek iç ağımızı tarayamamalı (SSRF)
function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local, bulut metadata (169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast ve rezerve
  );
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique local
  if (v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")) return true; // link-local
  // IPv4-mapped (::ffff:a.b.c.d)
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return true; // tanınmayan biçim: güvenli tarafta kal
}

const BLOCKED_HOST_SUFFIXES = [".local", ".internal", ".localhost", ".lan", ".home.arpa"];

/**
 * Hedef ana makinenin herkese açık bir adrese çözüldüğünü doğrular.
 * Not: DNS yeniden bağlama (rebinding) tam olarak engellenemez; Kuma konteynerinin
 * çıkış trafiği ayrıca ağ düzeyinde kısıtlanmalıdır (bkz. docs/DEPLOY-DOKPLOY.md).
 */
export async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new UnsafeTargetError("Bu ana makine izlenemez.");
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new UnsafeTargetError("Özel ağ adresleri izlenemez.");
    return;
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new UnsafeTargetError("Ana makine adı çözümlenemedi.");
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new UnsafeTargetError("Özel ağ adreslerine çözülen ana makineler izlenemez.");
  }
}

/** HTTP/KEYWORD hedefi için tam URL doğrulaması. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeTargetError("Geçersiz URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeTargetError("Yalnızca http ve https desteklenir.");
  }
  if (url.username || url.password) throw new UnsafeTargetError("URL kimlik bilgisi içeremez.");
  await assertPublicHost(url.hostname);
  return url;
}
