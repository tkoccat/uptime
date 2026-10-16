import { prisma } from "./prisma";
import { enforceRateLimit } from "./rate-limit";

// Heartbeat (cron) ping'leri: iş, ping adresine istek atar; biz Kuma'nın push uç noktasına iletiriz.
// Kuma adresi kullanıcıya hiç gösterilmez; ping adresi her zaman uygulamamızın alan adındadır.

export const PING_TOKEN_RE = /^[A-Za-z0-9]{32}$/;

export type PingResult = { status: 200 | 400 | 404 | 429 | 502; body: string; retryAfterSec?: number };

/** `/api/ping/<anahtar>` (başarı) ve `/api/ping/<anahtar>/fail` (başarısızlık bildirimi) yollarını ayrıştırır. */
export function parsePingPath(segments: string[]): { token: string; failed: boolean } | null {
  const [token, action, ...rest] = segments;
  if (!token || !PING_TOKEN_RE.test(token) || rest.length > 0) return null;
  if (action !== undefined && action !== "fail") return null;
  return { token, failed: action === "fail" };
}

/**
 * Ping'i doğrular ve Kuma'ya iletir.
 * - Anahtar bilinmiyorsa 404 (anahtarın varlığı dışarıya başka bilgi vermez)
 * - Anahtar başına dakikada 120 ping (kötüye kullanıma karşı)
 * - Duraklatılmış monitörün ping'i kabul edilir ama Kuma'ya iletilmez
 */
export async function handlePing(opts: { token: string; failed: boolean; message?: string; fetchFn?: typeof fetch }): Promise<PingResult> {
  const { token, failed } = opts;
  const doFetch = opts.fetchFn ?? fetch;

  const monitor = await prisma.monitor.findUnique({ where: { pingToken: token }, select: { id: true, type: true, isActive: true } });
  if (!monitor || monitor.type !== "HEARTBEAT") return { status: 404, body: "not found" };

  try {
    await enforceRateLimit(`ping:${token}`, 120, 60);
  } catch {
    return { status: 429, body: "rate limited", retryAfterSec: 60 };
  }

  await prisma.monitor.update({ where: { id: monitor.id }, data: { lastPingAt: new Date() } });
  if (!monitor.isActive) return { status: 200, body: "OK (paused)" };

  const base = process.env.UPTIME_KUMA_URL;
  if (!base) return { status: 502, body: "monitoring backend not configured" };

  const url = new URL(`/api/push/${token}`, base);
  url.searchParams.set("status", failed ? "down" : "up");
  url.searchParams.set("msg", (opts.message ?? (failed ? "Reported failure" : "OK")).slice(0, 200));
  url.searchParams.set("ping", "");

  try {
    const res = await doFetch(url, { method: "GET", signal: AbortSignal.timeout(8_000), redirect: "error" });
    if (!res.ok) return { status: 502, body: "monitoring backend error" };
  } catch {
    return { status: 502, body: "monitoring backend unreachable" };
  }
  return { status: 200, body: "OK" };
}
