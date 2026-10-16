import { KumaConnection } from "./connection";
import { SocketUptimeKumaAdapter } from "./socket-adapter";
import type { UptimeKumaAdapter } from "./types";

const globalForKuma = globalThis as unknown as { kumaAdapter?: UptimeKumaAdapter };

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} tanımlı değil`);
  return v;
}

// Adapter seçimi: şimdilik tek instance (SEÇENEK A). Kullanıcı başına instance (SEÇENEK B)
// için yeni bir adapter yazıp burada UPTIME_KUMA_ADAPTER değerine göre döndürmek yeterlidir.
export function getAdapter(): UptimeKumaAdapter {
  if (globalForKuma.kumaAdapter) return globalForKuma.kumaAdapter;

  const base = process.env.KUMA_WEBHOOK_BASE_URL ?? required("NEXT_PUBLIC_APP_URL");
  const secret = required("KUMA_WEBHOOK_SECRET");

  const conn = new KumaConnection({
    url: required("UPTIME_KUMA_URL"),
    username: required("UPTIME_KUMA_ADMIN_USERNAME"),
    password: required("UPTIME_KUMA_ADMIN_PASSWORD"),
  });

  globalForKuma.kumaAdapter = new SocketUptimeKumaAdapter(conn, {
    alertWebhookUrl: `${base.replace(/\/$/, "")}/api/webhooks/kuma?secret=${encodeURIComponent(secret)}`,
    kumaMajor: process.env.UPTIME_KUMA_MAJOR === "1" ? 1 : 2,
  });
  return globalForKuma.kumaAdapter;
}

// Test ve alternatif adapter'lar için
export function setAdapterForTests(adapter: UptimeKumaAdapter | undefined) {
  globalForKuma.kumaAdapter = adapter;
}

export type { UptimeKumaAdapter } from "./types";
