import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: Redis | null };

// REDIS_URL yoksa null döner; çağıranlar bellek içi yedeğe düşer (yalnızca geliştirme için)
export function getRedis(): Redis | null {
  if (globalForRedis.redis !== undefined) return globalForRedis.redis;
  const url = process.env.REDIS_URL;
  globalForRedis.redis = url
    ? new Redis(url, { maxRetriesPerRequest: 2, enableOfflineQueue: false, lazyConnect: false })
    : null;
  return globalForRedis.redis;
}

// BullMQ bloklayan komutlar kullandığı için ayrı bağlantı ve maxRetriesPerRequest: null ister
export function createBullConnection(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL tanımlı değil (kuyruk için gerekli)");
  return new Redis(url, { maxRetriesPerRequest: null });
}
