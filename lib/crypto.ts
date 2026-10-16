import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

// AES-256-GCM ile alan şifreleme (bildirim kanalı gizli bilgileri vb.).
// APP_ENCRYPTION_KEY: 32 baytlık hex dize (openssl rand -hex 32)
function key(): Buffer {
  const hex = process.env.APP_ENCRYPTION_KEY ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("APP_ENCRYPTION_KEY 64 karakterlik hex olmalıdır (openssl rand -hex 32)");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  if (!iv || !tag || !data) throw new Error("Geçersiz şifreli veri");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// İmzalı, süreli jetonlar (e-posta doğrulama bağlantıları): "<payload>.<imza>"
function hmac(data: string): string {
  return createHash("sha256").update(`${key().toString("hex")}:${data}`).digest("base64url");
}

export function signToken(payload: string, ttlSec = 7 * 24 * 3600): string {
  const body = Buffer.from(JSON.stringify({ p: payload, e: Math.floor(Date.now() / 1000) + ttlSec })).toString("base64url");
  return `${body}.${hmac(body)}`;
}

/** Geçerliyse payload'ı, değilse null döner. */
export function verifyToken(token: string): string | null {
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sig, hmac(body))) return null;
  try {
    const { p, e } = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { p: string; e: number };
    return e > Date.now() / 1000 ? p : null;
  } catch {
    return null;
  }
}

// Zamanlama saldırılarına karşı sabit sürede karşılaştırma
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
