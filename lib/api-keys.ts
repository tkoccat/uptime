import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { sha256 } from "./crypto";
import { AppError, NotFoundError, ValidationError } from "./errors";
import { assertApiAllowed } from "./plans";
import { enforceRateLimit, LIMITS } from "./rate-limit";

const MAX_ACTIVE_KEYS = 10;

/** Yeni API anahtarı üretir. Düz anahtar yalnızca bu çağrıda döner, sonrasında yalnızca özeti saklıdır. */
export async function createApiKey(userId: string, name: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError();
  assertApiAllowed(user.plan);

  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) throw new ValidationError("Key name is required");

  const active = await prisma.apiKey.count({ where: { userId, revokedAt: null } });
  if (active >= MAX_ACTIVE_KEYS) throw new ValidationError(`You can have up to ${MAX_ACTIVE_KEYS} active keys`);

  const key = `upk_${randomBytes(32).toString("base64url")}`;
  const record = await prisma.apiKey.create({
    data: { userId, name: trimmed, prefix: key.slice(0, 12), hash: sha256(key) },
  });
  return { id: record.id, key };
}

export async function revokeApiKey(userId: string, keyId: string) {
  // userId koşulu: başkasının anahtarı iptal edilemez
  const res = await prisma.apiKey.updateMany({ where: { id: keyId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (res.count === 0) throw new NotFoundError("API key not found");
}

/**
 * "Authorization: Bearer upk_..." başlığını doğrular, anahtar başına hız sınırı uygular ve
 * sahibini döndürür. Geçersiz/iptal/yetkisiz plan durumunda AppError fırlatır.
 */
export async function authenticateApiKey(authorization: string | null) {
  const match = authorization?.match(/^Bearer\s+(upk_[A-Za-z0-9_-]{20,})$/);
  if (!match) throw new AppError("Missing or invalid API key", "unauthorized", 401);

  const record = await prisma.apiKey.findUnique({ where: { hash: sha256(match[1]) }, include: { user: true } });
  if (!record || record.revokedAt) throw new AppError("Missing or invalid API key", "unauthorized", 401);

  assertApiAllowed(record.user.plan); // plan düşürülmüşse anahtar çalışmaz (402)
  await enforceRateLimit(`apikey:${record.id}`, LIMITS.apiKey.limit, LIMITS.apiKey.windowSec);

  // Son kullanım zamanı en fazla dakikada bir güncellenir (her istekte yazmamak için)
  if (!record.lastUsedAt || Date.now() - record.lastUsedAt.getTime() > 60_000) {
    await prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  }
  return record.user;
}
