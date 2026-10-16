import { io, type Socket } from "socket.io-client";

export type KumaConnectionOptions = {
  url: string;
  username: string;
  password: string;
  // Test için soket üreticisi enjekte edilebilir
  createSocket?: (url: string) => Socket;
  // Her istek için bekleme süresi (ms)
  timeoutMs?: number;
};

type Ack = { ok?: boolean; msg?: string; [key: string]: unknown };

export class KumaError extends Error {}

// Uptime Kuma Socket.IO bağlantısı: tembel bağlanır, giriş yapar, bağlantı kopunca yeniden giriş yapar.
export class KumaConnection {
  private socket: Socket | null = null;
  private ready: Promise<Socket> | null = null;
  // Giriş sonrası sunucunun yolladığı bildirim listesi (id, name, config)
  notificationList: { id: number; name: string }[] = [];
  private notificationListReady: Promise<void> | null = null;

  constructor(private readonly opts: KumaConnectionOptions) {}

  private get timeout() {
    return this.opts.timeoutMs ?? 15_000;
  }

  private async connect(): Promise<Socket> {
    const socket = (this.opts.createSocket ?? ((url) => io(url, { transports: ["websocket"], reconnection: true })))(
      this.opts.url
    );
    this.socket = socket;

    // Yeniden bağlanınca oturum sıfırlanır; bir sonraki istekte tekrar giriş yapılır
    socket.on("disconnect", () => {
      this.ready = null;
    });

    this.notificationListReady = new Promise<void>((resolve) => {
      socket.on("notificationList", (list: { id: number; name: string }[]) => {
        this.notificationList = list;
        resolve();
      });
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new KumaError("Uptime Kuma bağlantı zaman aşımı")), this.timeout);
      socket.once("connect", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once("connect_error", (err: Error) => {
        clearTimeout(timer);
        reject(new KumaError(`Uptime Kuma bağlantı hatası: ${err.message}`));
      });
    });

    const login = await this.emitRaw<Ack>(socket, "login", {
      username: this.opts.username,
      password: this.opts.password,
      token: "",
    });
    if (!login.ok) {
      socket.disconnect();
      throw new KumaError("Uptime Kuma girişi başarısız (kullanıcı adı/şifre veya 2FA)");
    }
    return socket;
  }

  private emitRaw<T>(socket: Socket, event: string, ...args: unknown[]): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      socket.timeout(this.timeout).emit(event, ...args, (err: Error | null, res: T) => {
        if (err) reject(new KumaError(`Uptime Kuma "${event}" isteği zaman aşımına uğradı`));
        else resolve(res);
      });
    });
  }

  private async getSocket(): Promise<Socket> {
    if (!this.ready) {
      this.ready = this.connect().catch((err) => {
        this.ready = null;
        throw err;
      });
    }
    return this.ready;
  }

  /** Giriş sonrası gelen bildirim listesinin hazır olmasını bekler (en fazla 5 sn). */
  async waitForNotificationList(): Promise<void> {
    await this.getSocket();
    await Promise.race([this.notificationListReady, new Promise((r) => setTimeout(r, 5000))]);
  }

  /** Bir olay yollar; `ok: false` dönerse KumaError fırlatır. */
  async call<T extends Ack = Ack>(event: string, ...args: unknown[]): Promise<T> {
    const socket = await this.getSocket();
    const res = await this.emitRaw<T>(socket, event, ...args);
    if (res && res.ok === false) throw new KumaError(res.msg ?? `Uptime Kuma "${event}" başarısız`);
    return res;
  }

  close() {
    this.socket?.disconnect();
    this.socket = null;
    this.ready = null;
  }
}
