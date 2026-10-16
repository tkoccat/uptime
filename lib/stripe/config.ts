import { decrypt, encrypt } from "../crypto";
import { prisma } from "../prisma";

// Stripe anahtarları admin panelinden girilebilir (veritabanında AES-256-GCM ile şifreli).
// Panelde değer varsa ortam değişkeninin önüne geçer; yoksa ortam değişkenlerine düşülür.

export type StripeKeys = { secretKey?: string; webhookSecret?: string; publishableKey?: string; source: "admin" | "env" | "none" };

type Stored = { secretKeyEnc?: string; webhookSecretEnc?: string; publishableKey?: string };

const SETTING_KEY = "stripe";
let cache: { at: number; keys: StripeKeys } | null = null;
const TTL_MS = 30_000;

export function invalidateStripeKeys() {
  cache = null;
}

const safeDecrypt = (v?: string) => {
  if (!v) return undefined;
  try {
    return decrypt(v);
  } catch {
    return undefined;
  }
};

export async function getStripeKeys(): Promise<StripeKeys> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.keys;

  let stored: Stored = {};
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: SETTING_KEY } });
    stored = (row?.value as Stored | null) ?? {};
  } catch {
    // Veritabanına ulaşılamazsa ortam değişkenleriyle devam edilir
  }

  const secretKey = safeDecrypt(stored.secretKeyEnc) || process.env.STRIPE_SECRET_KEY?.trim() || undefined;
  const webhookSecret = safeDecrypt(stored.webhookSecretEnc) || process.env.STRIPE_WEBHOOK_SECRET?.trim() || undefined;
  const publishableKey = stored.publishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || undefined;
  const source = stored.secretKeyEnc && safeDecrypt(stored.secretKeyEnc) ? "admin" : secretKey ? "env" : "none";

  const keys: StripeKeys = { secretKey, webhookSecret, publishableKey, source };
  cache = { at: Date.now(), keys };
  return keys;
}

export async function isStripeConfigured(): Promise<boolean> {
  return Boolean((await getStripeKeys()).secretKey);
}

/** Admin panelinden gelen anahtarlar; boş bırakılan alan mevcut değeri korur. */
export async function saveStripeKeys(input: { secretKey?: string; webhookSecret?: string; publishableKey?: string }): Promise<void> {
  const row = await prisma.siteSetting.findUnique({ where: { key: SETTING_KEY } });
  const cur = (row?.value as Stored | null) ?? {};
  const next: Stored = { ...cur };
  if (input.secretKey) next.secretKeyEnc = encrypt(input.secretKey);
  if (input.webhookSecret) next.webhookSecretEnc = encrypt(input.webhookSecret);
  if (input.publishableKey) next.publishableKey = input.publishableKey;
  await prisma.siteSetting.upsert({ where: { key: SETTING_KEY }, create: { key: SETTING_KEY, value: next }, update: { value: next } });
  invalidateStripeKeys();
}

/** Panelde kaydedilmiş anahtarları siler (ortam değişkenlerine geri dönülür). */
export async function clearStripeKeys(): Promise<void> {
  await prisma.siteSetting.deleteMany({ where: { key: SETTING_KEY } });
  invalidateStripeKeys();
}

/** Anahtar biçimi denetimi: gizli anahtarın yanlış alana yapıştırılmasını yakalar. */
export function validateStripeKeyShapes(i: { secretKey?: string; webhookSecret?: string; publishableKey?: string }): string | null {
  if (i.secretKey && !/^(sk|rk)_(test|live)_[A-Za-z0-9]+$/.test(i.secretKey)) return "Secret key must start with sk_test_ / sk_live_ (or rk_ for a restricted key)";
  if (i.webhookSecret && !/^whsec_[A-Za-z0-9]+$/.test(i.webhookSecret)) return "Webhook signing secret must start with whsec_";
  if (i.publishableKey && !/^pk_(test|live)_[A-Za-z0-9]+$/.test(i.publishableKey)) return "Publishable key must start with pk_test_ / pk_live_";
  return null;
}
