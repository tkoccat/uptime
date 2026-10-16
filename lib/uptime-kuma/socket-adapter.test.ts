import { describe, expect, it, vi } from "vitest";
import { KumaConnection } from "./connection";
import { SocketUptimeKumaAdapter } from "./socket-adapter";

// Gerçek soket yerine KumaConnection'ın `call` ve bildirim listesi davranışı taklit edilir
function fakeConn(responses: Record<string, unknown> = {}, notifications: { id: number; name: string }[] = []) {
  const call = vi.fn(async (event: string, ...args: unknown[]) => {
    void args;
    return (responses[event] ?? { ok: true }) as never;
  });
  const conn = {
    call,
    notificationList: notifications,
    waitForNotificationList: vi.fn(async () => undefined),
  };
  return { conn: conn as unknown as KumaConnection, call };
}

const opts = { alertWebhookUrl: "http://app/api/webhooks/kuma?secret=s", kumaMajor: 2 as const };

describe("SocketUptimeKumaAdapter", () => {
  it("webhook bildirimi yoksa oluşturur ve kimliğini önbelleğe alır", async () => {
    const { conn, call } = fakeConn({ addNotification: { ok: true, id: 7 } });
    const adapter = new SocketUptimeKumaAdapter(conn, opts);
    expect(await adapter.ensureAlertWebhook()).toBe(7);
    expect(await adapter.ensureAlertWebhook()).toBe(7);
    expect(call.mock.calls.filter((c) => c[0] === "addNotification")).toHaveLength(1);
    const [, payload] = call.mock.calls[0];
    expect(payload).toMatchObject({ type: "webhook", webhookURL: opts.alertWebhookUrl, webhookContentType: "json" });
  });

  it("webhook bildirimi zaten varsa yeniden oluşturmaz (yeniden başlatmada çift kayıt olmaz)", async () => {
    const { conn, call } = fakeConn({}, [{ id: 3, name: "saas-alert-webhook" }]);
    const adapter = new SocketUptimeKumaAdapter(conn, opts);
    expect(await adapter.ensureAlertWebhook()).toBe(3);
    expect(call).not.toHaveBeenCalled();
  });

  it("monitör oluştururken kiracıyı açıklamaya yazar ve webhook'u bağlar", async () => {
    const { conn, call } = fakeConn({ addNotification: { ok: true, id: 9 }, add: { ok: true, monitorID: 42 } });
    const adapter = new SocketUptimeKumaAdapter(conn, opts);
    const res = await adapter.createMonitor("user-1", { name: "Site", target: "https://example.com", type: "HTTP", interval: 60 });
    expect(res).toEqual({ kumaId: 42 });
    const payload = call.mock.calls.find((c) => c[0] === "add")![1] as Record<string, unknown>;
    expect(payload).toMatchObject({
      type: "http",
      name: "Site",
      url: "https://example.com",
      interval: 60,
      description: "tenant:user-1",
      notificationIDList: { 9: true },
    });
  });

  it("PORT hedefini host ve port olarak ayırır", async () => {
    const { conn, call } = fakeConn({ addNotification: { ok: true, id: 1 }, add: { ok: true, monitorID: 5 } });
    await new SocketUptimeKumaAdapter(conn, opts).createMonitor("u", { name: "DB", target: "example.com:5432", type: "PORT", interval: 60 });
    const payload = call.mock.calls.find((c) => c[0] === "add")![1];
    expect(payload).toMatchObject({ type: "port", hostname: "example.com", port: 5432 });
  });

  it("Kuma monitör kimliği dönmezse hata verir", async () => {
    const { conn } = fakeConn({ addNotification: { ok: true, id: 1 }, add: { ok: true } });
    await expect(
      new SocketUptimeKumaAdapter(conn, opts).createMonitor("u", { name: "x", target: "https://e.com", type: "HTTP", interval: 60 })
    ).rejects.toThrow();
  });

  it("v2'de deleteMonitor ek 'deleteChildren' argümanıyla, v1'de onsuz çağrılır", async () => {
    const v2 = fakeConn();
    await new SocketUptimeKumaAdapter(v2.conn, { ...opts, kumaMajor: 2 }).deleteMonitor("u", 5);
    expect(v2.call).toHaveBeenCalledWith("deleteMonitor", 5, false);

    const v1 = fakeConn();
    await new SocketUptimeKumaAdapter(v1.conn, { ...opts, kumaMajor: 1 }).deleteMonitor("u", 5);
    expect(v1.call).toHaveBeenCalledWith("deleteMonitor", 5);
  });

  it("duraklat/sürdür doğru olayı yollar", async () => {
    const { conn, call } = fakeConn();
    const adapter = new SocketUptimeKumaAdapter(conn, opts);
    await adapter.setMonitorActive("u", 1, false);
    await adapter.setMonitorActive("u", 1, true);
    expect(call.mock.calls.map((c) => c[0])).toEqual(["pauseMonitor", "resumeMonitor"]);
  });

  it("geçmişi ISO zamana çevirir, eskiden yeniye sıralar ve son durumu verir", async () => {
    const { conn } = fakeConn({
      getMonitorBeats: {
        ok: true,
        data: [
          { status: 1, time: "2026-10-16 10:05:00.000", ping: 120, msg: "200 - OK" },
          { status: 0, time: "2026-10-16 10:00:00.000", ping: null, msg: "timeout" },
          { status: 2, time: "2026-10-16 10:10:00.000", ping: null, msg: "" },
        ],
      },
    });
    const adapter = new SocketUptimeKumaAdapter(conn, opts);
    const history = await adapter.getMonitorHistory("u", 1, 24);
    expect(history.map((h) => h.status)).toEqual(["down", "up", "pending"]);
    expect(history[0].time).toBe("2026-10-16T10:00:00.000Z");
    expect((await adapter.getMonitorStatus("u", 1)).status).toBe("pending");
  });

  it("kayıt yoksa durum 'pending' döner", async () => {
    const { conn } = fakeConn({ getMonitorBeats: { ok: true, data: [] } });
    expect((await new SocketUptimeKumaAdapter(conn, opts).getMonitorStatus("u", 1)).status).toBe("pending");
  });
});
