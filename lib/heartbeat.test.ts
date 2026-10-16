import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ monitor: { findUnique: vi.fn(), update: vi.fn() } }));
vi.mock("./prisma", () => ({ prisma: db }));

import { handlePing, parsePingPath } from "./heartbeat";

const TOKEN = "A".repeat(32);
let n = 0;
const tok = () => `T${String(++n).padStart(31, "0")}`; // her testte farklı anahtar: hız sınırı sayaçları karışmaz

const ok = () => vi.fn(async (...args: unknown[]) => (void args, new Response("{}", { status: 200 })));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.UPTIME_KUMA_URL = "http://kuma:3001";
  db.monitor.update.mockResolvedValue({});
});

describe("parsePingPath", () => {
  it("başarı ve fail yollarını tanır", () => {
    expect(parsePingPath([TOKEN])).toEqual({ token: TOKEN, failed: false });
    expect(parsePingPath([TOKEN, "fail"])).toEqual({ token: TOKEN, failed: true });
  });
  it("geçersiz anahtar, eylem veya fazla segment reddedilir", () => {
    expect(parsePingPath([])).toBeNull();
    expect(parsePingPath(["short"])).toBeNull();
    expect(parsePingPath([TOKEN, "start"])).toBeNull();
    expect(parsePingPath([TOKEN, "fail", "x"])).toBeNull();
    expect(parsePingPath(["../etc/passwd" + "x".repeat(20)])).toBeNull();
  });
});

describe("handlePing", () => {
  it("bilinmeyen anahtar ve heartbeat olmayan monitör 404 döner, Kuma'ya gidilmez", async () => {
    const fetchFn = ok();
    db.monitor.findUnique.mockResolvedValue(null);
    expect((await handlePing({ token: tok(), failed: false, fetchFn })).status).toBe(404);
    db.monitor.findUnique.mockResolvedValue({ id: "m", type: "HTTP", isActive: true });
    expect((await handlePing({ token: tok(), failed: false, fetchFn })).status).toBe(404);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("başarı ping'i Kuma push uç noktasına status=up ile iletilir ve son ping kaydedilir", async () => {
    const fetchFn = ok();
    const token = tok();
    db.monitor.findUnique.mockResolvedValue({ id: "m1", type: "HEARTBEAT", isActive: true });
    const res = await handlePing({ token, failed: false, message: "backup done", fetchFn });
    expect(res).toMatchObject({ status: 200, body: "OK" });
    const url = fetchFn.mock.calls[0][0] as URL;
    expect(url.origin).toBe("http://kuma:3001");
    expect(url.pathname).toBe(`/api/push/${token}`);
    expect(url.searchParams.get("status")).toBe("up");
    expect(url.searchParams.get("msg")).toBe("backup done");
    expect(db.monitor.update).toHaveBeenCalledWith({ where: { id: "m1" }, data: { lastPingAt: expect.any(Date) } });
  });

  it("fail ping'i status=down gönderir", async () => {
    const fetchFn = ok();
    db.monitor.findUnique.mockResolvedValue({ id: "m1", type: "HEARTBEAT", isActive: true });
    await handlePing({ token: tok(), failed: true, fetchFn });
    expect((fetchFn.mock.calls[0][0] as URL).searchParams.get("status")).toBe("down");
  });

  it("uzun mesaj 200 karakterle sınırlanır", async () => {
    const fetchFn = ok();
    db.monitor.findUnique.mockResolvedValue({ id: "m1", type: "HEARTBEAT", isActive: true });
    await handlePing({ token: tok(), failed: false, message: "x".repeat(500), fetchFn });
    expect((fetchFn.mock.calls[0][0] as URL).searchParams.get("msg")).toHaveLength(200);
  });

  it("duraklatılmış monitörün ping'i kabul edilir ama iletilmez", async () => {
    const fetchFn = ok();
    db.monitor.findUnique.mockResolvedValue({ id: "m1", type: "HEARTBEAT", isActive: false });
    const res = await handlePing({ token: tok(), failed: false, fetchFn });
    expect(res.status).toBe(200);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("Kuma hata verirse veya erişilemezse 502 döner", async () => {
    db.monitor.findUnique.mockResolvedValue({ id: "m1", type: "HEARTBEAT", isActive: true });
    expect((await handlePing({ token: tok(), failed: false, fetchFn: vi.fn(async () => new Response("x", { status: 500 })) })).status).toBe(502);
    expect((await handlePing({ token: tok(), failed: false, fetchFn: vi.fn(async () => Promise.reject(new Error("down"))) })).status).toBe(502);
  });

  it("anahtar başına dakikada 120 ping sınırı uygulanır", async () => {
    const fetchFn = ok();
    const token = tok();
    db.monitor.findUnique.mockResolvedValue({ id: "m1", type: "HEARTBEAT", isActive: true });
    for (let i = 0; i < 120; i++) expect((await handlePing({ token, failed: false, fetchFn })).status).toBe(200);
    const res = await handlePing({ token, failed: false, fetchFn });
    expect(res).toMatchObject({ status: 429, retryAfterSec: 60 });
  });
});
