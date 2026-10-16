import { RateLimitError } from "./errors";
import { getRedis } from "./redis";

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

export interface RateLimitStore {
  /** Anahtarın sayacını 1 artırır; ilk artışta pencere süresini başlatır. */
  hit(key: string, windowSec: number): Promise<{ count: number; ttlSec: number }>;
}

// Redis tabanlı sabit pencere sayacı (INCR + EXPIRE)
export class RedisStore implements RateLimitStore {
  async hit(key: string, windowSec: number) {
    const redis = getRedis();
    if (!redis) throw new Error("Redis yok");
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSec);
    const ttl = await redis.ttl(key);
    return { count, ttlSec: ttl > 0 ? ttl : windowSec };
  }
}

// Geliştirme/test için bellek içi sayaç
export class MemoryStore implements RateLimitStore {
  private map = new Map<string, { count: number; resetAt: number }>();

  async hit(key: string, windowSec: number) {
    const now = Date.now();
    const entry = this.map.get(key);
    if (!entry || entry.resetAt <= now) {
      this.map.set(key, { count: 1, resetAt: now + windowSec * 1000 });
      return { count: 1, ttlSec: windowSec };
    }
    entry.count += 1;
    return { count: entry.count, ttlSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }
}

const memory = new MemoryStore();

function defaultStore(): RateLimitStore {
  return getRedis() ? new RedisStore() : memory;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
  store: RateLimitStore = defaultStore()
): Promise<RateLimitResult> {
  let hit: { count: number; ttlSec: number };
  try {
    hit = await store.hit(`rl:${key}`, windowSec);
  } catch (err) {
    // Redis çökerse hizmeti durdurmak yerine bellek içi sayaca düşülür (tek instance için yeterli koruma)
    console.error("rate-limit store hatası, bellek içi sayaca düşüldü:", err);
    hit = await memory.hit(`rl:${key}`, windowSec);
  }
  return {
    ok: hit.count <= limit,
    remaining: Math.max(0, limit - hit.count),
    retryAfterSec: hit.ttlSec,
  };
}

/** Limit aşılırsa RateLimitError fırlatır. */
export async function enforceRateLimit(
  key: string,
  limit: number,
  windowSec: number,
  store?: RateLimitStore
): Promise<void> {
  const res = await rateLimit(key, limit, windowSec, store);
  if (!res.ok) throw new RateLimitError(res.retryAfterSec);
}

// Ortak limit ayarları
export const LIMITS = {
  monitorMutations: { limit: 30, windowSec: 60 }, // kullanıcı başına ekleme/silme
  apiKey: { limit: 60, windowSec: 60 }, // API anahtarı başına
  auth: { limit: 10, windowSec: 300 }, // IP başına giriş/kayıt/şifre sıfırlama
} as const;
