import { getRedis } from "../redis";
import { prisma } from "../prisma";
import { getStripe } from "../stripe/client";
import { getAdapter } from "../uptime-kuma";

export type Check = { name: string; ok: boolean; detail: string };

async function attempt(name: string, work: () => Promise<string>): Promise<Check> {
  try {
    return { name, ok: true, detail: await work() };
  } catch (err) {
    // Hata metni gizli bilgi içermesin diye kısaltılır
    return { name, ok: false, detail: String((err as Error).message ?? err).slice(0, 160) };
  }
}

const has = (v: string | undefined) => Boolean(v && v.trim());

/** Bağlantı denemeleri: veritabanı, Redis, Uptime Kuma, Stripe. */
export async function runConnectionChecks(): Promise<Check[]> {
  return Promise.all([
    attempt("PostgreSQL", async () => `${await prisma.user.count()} users`),
    attempt("Redis", async () => {
      const r = getRedis();
      if (!r) return "REDIS_URL not set (rate limits in memory, jobs run in-process)";
      return `PING ${await r.ping()}`;
    }),
    attempt("Uptime Kuma", async () => {
      const id = await getAdapter().ensureAlertWebhook();
      return `connected, alert webhook notification #${id}`;
    }),
    attempt("Stripe", async () => {
      if (!has(process.env.STRIPE_SECRET_KEY)) throw new Error("STRIPE_SECRET_KEY not set");
      const balance = await getStripe().balance.retrieve();
      return `connected (${balance.livemode ? "live" : "test"} mode)`;
    }),
  ]);
}

/** Yalnızca değişkenin tanımlı olup olmadığı gösterilir; değerler asla gösterilmez. */
export function envStatus(): { group: string; items: { name: string; set: boolean; required: boolean }[] }[] {
  const e = process.env;
  const item = (name: string, required = false) => ({ name, set: has(e[name]), required });
  return [
    { group: "Core", items: [item("NEXT_PUBLIC_APP_URL", true), item("DATABASE_URL", true), item("APP_ENCRYPTION_KEY", true), item("ADMIN_EMAIL", true), item("REDIS_URL")] },
    { group: "Supabase (sign-in)", items: [item("NEXT_PUBLIC_SUPABASE_URL", true), item("NEXT_PUBLIC_SUPABASE_ANON_KEY", true), item("SUPABASE_SERVICE_ROLE_KEY")] },
    { group: "Uptime Kuma", items: [item("UPTIME_KUMA_URL", true), item("UPTIME_KUMA_ADMIN_USERNAME", true), item("UPTIME_KUMA_ADMIN_PASSWORD", true), item("KUMA_WEBHOOK_SECRET", true)] },
    { group: "Payments", items: [item("STRIPE_SECRET_KEY"), item("STRIPE_WEBHOOK_SECRET"), item("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")] },
    { group: "Email & SMS", items: [item("RESEND_API_KEY"), item("EMAIL_FROM"), item("TWILIO_ACCOUNT_SID")] },
    { group: "Domains & TLS", items: [item("NEXT_PUBLIC_STATUS_BASE_DOMAIN"), item("CADDY_ASK_SECRET"), item("STATUS_SERVER_IP")] },
    { group: "Marketing", items: [item("NEXT_PUBLIC_GTAG_ID"), item("NEXT_PUBLIC_META_PIXEL_ID")] },
  ];
}
