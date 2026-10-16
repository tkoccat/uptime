import { KumaConnection, KumaError } from "./connection";
import type { Heartbeat, HeartbeatStatus, KumaMonitorInput, MonitorKind, UptimeKumaAdapter } from "./types";

// SEÇENEK A: tek Uptime Kuma instance, tek servis hesabı.
// NOT: Uptime Kuma çoklu kullanıcıyı desteklemez (yalnızca tek yönetici hesabı vardır).
// Bu yüzden izolasyon uygulama katmanında sağlanır: her monitör kendi DB kaydıyla eşlenir,
// sahiplik her istekte DB'den kontrol edilir (bkz. lib/uptimeKuma.ts) ve Kuma monitörünün
// açıklama alanına denetim için "tenant:<userId>" yazılır. Kuma'dan hiçbir zaman "tümünü listele" yapılmaz.

const KUMA_TYPE: Record<MonitorKind, string> = {
  HTTP: "http",
  KEYWORD: "keyword",
  PING: "ping",
  PORT: "port",
  DNS: "dns",
  HEARTBEAT: "push",
};

const WEBHOOK_NOTIFICATION_NAME = "saas-alert-webhook";

// Kuma kalp atışı durum kodları: 0 down, 1 up, 2 pending, 3 maintenance
const STATUS: Record<number, HeartbeatStatus> = { 0: "down", 1: "up", 2: "pending", 3: "maintenance" };

type RawBeat = { status: number; time: string; ping: number | null; msg?: string | null };

// Kuma zamanı "YYYY-MM-DD HH:mm:ss.SSS" (UTC) biçimindedir
function toIso(time: string): string {
  return time.includes("T") ? time : `${time.replace(" ", "T")}Z`;
}

function toHeartbeat(b: RawBeat): Heartbeat {
  return {
    status: STATUS[b.status] ?? "pending",
    time: toIso(b.time),
    ping: b.ping ?? null,
    message: b.msg ?? null,
  };
}

export type SocketAdapterOptions = {
  // Kuma'nın olayları ileteceği uygulama adresi (gizli anahtar dahil)
  alertWebhookUrl: string;
  // Kuma ana sürümü: v2'de deleteMonitor ek bir "deleteChildren" argümanı alır
  kumaMajor?: 1 | 2;
};

export class SocketUptimeKumaAdapter implements UptimeKumaAdapter {
  private webhookId: number | null = null;

  constructor(
    private readonly conn: KumaConnection,
    private readonly opts: SocketAdapterOptions
  ) {}

  async ensureAlertWebhook(): Promise<number> {
    if (this.webhookId !== null) return this.webhookId;

    await this.conn.waitForNotificationList();
    const existing = this.conn.notificationList.find((n) => n.name === WEBHOOK_NOTIFICATION_NAME);
    if (existing) {
      this.webhookId = existing.id;
      return existing.id;
    }

    const res = await this.conn.call<{ ok: boolean; id?: number }>("addNotification", {
      name: WEBHOOK_NOTIFICATION_NAME,
      type: "webhook",
      isDefault: false,
      applyExisting: false,
      active: true,
      webhookURL: this.opts.alertWebhookUrl,
      webhookContentType: "json",
    }, null);
    if (typeof res.id !== "number") throw new KumaError("Uptime Kuma bildirim kimliği dönmedi");
    this.webhookId = res.id;
    return res.id;
  }

  async createMonitor(tenantId: string, input: KumaMonitorInput): Promise<{ kumaId: number }> {
    const webhookId = await this.ensureAlertWebhook();

    // PORT için "host:port" ayrıştırılır
    let hostname: string | undefined;
    let port: number | undefined;
    if (input.type === "PORT") {
      const [h, p] = input.target.split(":");
      hostname = h;
      port = Number(p);
    } else if (input.type === "PING" || input.type === "DNS") {
      hostname = input.target;
    }

    const monitor = {
      type: KUMA_TYPE[input.type],
      name: input.name,
      parent: null,
      url: input.type === "HTTP" || input.type === "KEYWORD" ? input.target : "https://",
      method: "GET",
      hostname,
      port,
      keyword: input.keyword ?? "",
      // Push (heartbeat) monitörü: Kuma bu anahtara gelen istekleri bekler, gelmezse çöktü sayar
      pushToken: input.pushToken,
      interval: input.interval,
      retryInterval: input.interval,
      resendInterval: 0,
      maxretries: 0,
      timeout: Math.min(48, Math.floor(input.interval * 0.8)),
      notificationIDList: { [webhookId]: true },
      ignoreTls: false,
      upsideDown: false,
      expiryNotification: false,
      maxredirects: 10,
      accepted_statuscodes: ["200-299"],
      dns_resolve_type: "A",
      dns_resolve_server: "1.1.1.1",
      proxyId: null,
      authMethod: null,
      httpBodyEncoding: "json",
      body: null,
      headers: null,
      description: `tenant:${tenantId}`,
      conditions: [],
    };

    const res = await this.conn.call<{ ok: boolean; monitorID?: number }>("add", monitor);
    if (typeof res.monitorID !== "number") throw new KumaError("Uptime Kuma monitör kimliği dönmedi");
    return { kumaId: res.monitorID };
  }

  async deleteMonitor(_tenantId: string, kumaId: number): Promise<void> {
    if ((this.opts.kumaMajor ?? 2) === 2) {
      await this.conn.call("deleteMonitor", kumaId, false);
    } else {
      await this.conn.call("deleteMonitor", kumaId);
    }
  }

  async setMonitorActive(_tenantId: string, kumaId: number, active: boolean): Promise<void> {
    await this.conn.call(active ? "resumeMonitor" : "pauseMonitor", kumaId);
  }

  async getMonitorHistory(_tenantId: string, kumaId: number, hours: number): Promise<Heartbeat[]> {
    const res = await this.conn.call<{ ok: boolean; data?: RawBeat[] }>("getMonitorBeats", kumaId, hours);
    return (res.data ?? [])
      .map(toHeartbeat)
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  async getMonitorStatus(tenantId: string, kumaId: number): Promise<Heartbeat> {
    const beats = await this.getMonitorHistory(tenantId, kumaId, 1);
    return beats[beats.length - 1] ?? { status: "pending", time: new Date().toISOString(), ping: null, message: null };
  }
}
