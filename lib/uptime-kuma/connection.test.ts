import { EventEmitter } from "node:events";
import type { Socket } from "socket.io-client";
import { describe, expect, it, vi } from "vitest";
import { KumaConnection, KumaError } from "./connection";

// Socket.IO istemcisini taklit eden küçük sahte soket
class FakeSocket extends EventEmitter {
  sent: { event: string; args: unknown[] }[] = [];
  connected = false;
  constructor(private handler: (event: string, args: unknown[]) => unknown, private connectError?: Error) {
    super();
    queueMicrotask(() => {
      if (this.connectError) this.emit("connect_error", this.connectError);
      else {
        this.connected = true;
        this.emit("connect");
      }
    });
  }
  timeout() {
    return {
      emit: (event: string, ...rest: unknown[]) => {
        const cb = rest.pop() as (err: Error | null, res: unknown) => void;
        this.sent.push({ event, args: rest });
        const res = this.handler(event, rest);
        if (res === "TIMEOUT") cb(new Error("timeout"), undefined);
        else cb(null, res);
        if (event === "login") this.emit("notificationList", [{ id: 1, name: "saas-alert-webhook" }]);
      },
    };
  }
  disconnect() {
    this.connected = false;
    this.emit("disconnect");
  }
}

const make = (handler: (e: string, a: unknown[]) => unknown, connectError?: Error) => {
  const sockets: FakeSocket[] = [];
  const conn = new KumaConnection({
    url: "http://kuma",
    username: "admin",
    password: "pw",
    timeoutMs: 200,
    createSocket: () => {
      const s = new FakeSocket(handler, connectError);
      sockets.push(s);
      return s as unknown as Socket;
    },
  });
  return { conn, sockets };
};

describe("KumaConnection", () => {
  it("ilk istekte bağlanır, giriş yapar ve isteği iletir", async () => {
    const { conn, sockets } = make((event) => (event === "login" ? { ok: true, token: "t" } : { ok: true, monitorID: 1 }));
    const res = await conn.call<{ ok: boolean; monitorID: number }>("add", { name: "x" });
    expect(res.monitorID).toBe(1);
    expect(sockets[0].sent.map((s) => s.event)).toEqual(["login", "add"]);
    expect(sockets[0].sent[0].args[0]).toMatchObject({ username: "admin", password: "pw" });
  });

  it("art arda isteklerde tek bağlantı ve tek giriş kullanır", async () => {
    const { conn, sockets } = make(() => ({ ok: true }));
    await conn.call("pauseMonitor", 1);
    await conn.call("resumeMonitor", 1);
    expect(sockets).toHaveLength(1);
    expect(sockets[0].sent.filter((s) => s.event === "login")).toHaveLength(1);
  });

  it("giriş reddedilirse KumaError fırlatır ve bir sonraki istekte yeniden dener", async () => {
    let allow = false;
    const { conn, sockets } = make((event) => (event === "login" ? { ok: allow } : { ok: true }));
    await expect(conn.call("add", {})).rejects.toBeInstanceOf(KumaError);
    allow = true;
    await expect(conn.call("add", {})).resolves.toMatchObject({ ok: true });
    expect(sockets).toHaveLength(2);
  });

  it("sunucu ok:false dönerse mesajıyla hata fırlatır", async () => {
    const { conn } = make((event) => (event === "login" ? { ok: true } : { ok: false, msg: "bad monitor" }));
    await expect(conn.call("add", {})).rejects.toThrow("bad monitor");
  });

  it("yanıt zaman aşımına uğrarsa KumaError fırlatır", async () => {
    const { conn } = make((event) => (event === "login" ? { ok: true } : "TIMEOUT"));
    await expect(conn.call("getMonitorBeats", 1, 24)).rejects.toThrow(/zaman aşımı/);
  });

  it("bağlantı hatasını KumaError olarak bildirir", async () => {
    const { conn } = make(() => ({ ok: true }), new Error("ECONNREFUSED"));
    await expect(conn.call("add", {})).rejects.toThrow(/ECONNREFUSED/);
  });

  it("bağlantı kopunca sonraki istek yeni bağlantı kurar", async () => {
    const { conn, sockets } = make(() => ({ ok: true }));
    await conn.call("add", {});
    sockets[0].emit("disconnect");
    await conn.call("add", {});
    expect(sockets).toHaveLength(2);
  });

  it("giriş sonrası gelen bildirim listesini yakalar", async () => {
    const { conn } = make(() => ({ ok: true }));
    await conn.waitForNotificationList();
    expect(conn.notificationList).toEqual([{ id: 1, name: "saas-alert-webhook" }]);
    vi.clearAllMocks();
  });
});
