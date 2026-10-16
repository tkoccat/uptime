// Uptime Kuma soyutlama katmanının ortak tipleri.
// SEÇENEK B'ye (kullanıcı başına instance) geçmek için yalnızca yeni bir UptimeKumaAdapter yazmak yeterlidir.

import type { MonitorOptions } from "../monitor-options";

export type MonitorKind = "HTTP" | "KEYWORD" | "PING" | "PORT" | "DNS" | "HEARTBEAT";

export type KumaMonitorInput = {
  name: string;
  // HTTP/KEYWORD için tam URL; PING/PORT/DNS için ana makine adı (PORT için "host:port")
  target: string;
  type: MonitorKind;
  // Kontrol aralığı (saniye)
  interval: number;
  keyword?: string;
  // HEARTBEAT: Kuma push anahtarı (uygulamamızın ping adresindeki gizli parça)
  pushToken?: string;
  // Gelişmiş ayarlar (yeniden deneme, kabul edilen kodlar, başlıklar vb.); verilmezse varsayılanlar
  options?: MonitorOptions;
  description?: string;
};

export type HeartbeatStatus = "up" | "down" | "pending" | "maintenance";

export type Heartbeat = {
  status: HeartbeatStatus;
  // ISO 8601 (UTC)
  time: string;
  ping: number | null;
  message: string | null;
};

export interface UptimeKumaAdapter {
  /** Monitör oluşturur ve Uptime Kuma tarafındaki kimliği döndürür. */
  createMonitor(tenantId: string, input: KumaMonitorInput): Promise<{ kumaId: number }>;
  /** Var olan monitörün ayarlarını günceller (tür değişmez). */
  updateMonitor(tenantId: string, kumaId: number, input: KumaMonitorInput): Promise<void>;
  deleteMonitor(tenantId: string, kumaId: number): Promise<void>;
  setMonitorActive(tenantId: string, kumaId: number, active: boolean): Promise<void>;
  /** Son geçerli kalp atışı; kayıt yoksa "pending". */
  getMonitorStatus(tenantId: string, kumaId: number): Promise<Heartbeat>;
  /** Son `hours` saatin kalp atışları, eskiden yeniye sıralı. */
  getMonitorHistory(tenantId: string, kumaId: number, hours: number): Promise<Heartbeat[]>;
  /**
   * Uptime Kuma'nın olayları uygulamamıza iletmesi için kullanılan tek webhook bildirimini
   * garanti eder (yoksa oluşturur) ve kimliğini döndürür.
   */
  ensureAlertWebhook(): Promise<number>;
}
