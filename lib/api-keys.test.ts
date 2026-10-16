import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  apiKey: { count: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
}));
vi.mock("./prisma", () => ({ prisma: db }));

import { authenticateApiKey, createApiKey, revokeApiKey } from "./api-keys";
import { sha256 } from "./crypto";
import { NotFoundError, PlanLimitError } from "./errors";

beforeEach(() => vi.clearAllMocks());

describe("API anahtarları", () => {
  it("Free plan API anahtarı oluşturamaz", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u", plan: "FREE" });
    await expect(createApiKey("u", "ci")).rejects.toBeInstanceOf(PlanLimitError);
  });

  it("düz anahtar yalnızca dönüşte vardır, DB'ye yalnızca özeti yazılır", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u", plan: "PRO" });
    db.apiKey.count.mockResolvedValue(0);
    db.apiKey.create.mockImplementation(async ({ data }) => ({ id: "k1", ...data }));
    const { key } = await createApiKey("u", "ci");
    expect(key).toMatch(/^upk_[A-Za-z0-9_-]{40,}$/);
    const saved = db.apiKey.create.mock.calls[0][0].data;
    expect(saved.hash).toBe(sha256(key));
    expect(JSON.stringify(saved)).not.toContain(key);
    expect(saved.prefix).toBe(key.slice(0, 12));
  });

  it("başkasının anahtarı iptal edilemez", async () => {
    db.apiKey.updateMany.mockResolvedValue({ count: 0 });
    await expect(revokeApiKey("u", "k-of-someone-else")).rejects.toBeInstanceOf(NotFoundError);
    expect(db.apiKey.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "k-of-someone-else", userId: "u", revokedAt: null } }));
  });

  describe("authenticateApiKey", () => {
    const key = `upk_${"a".repeat(43)}`;

    it("başlık yoksa veya biçim yanlışsa 401", async () => {
      await expect(authenticateApiKey(null)).rejects.toMatchObject({ status: 401 });
      await expect(authenticateApiKey("Basic abc")).rejects.toMatchObject({ status: 401 });
      await expect(authenticateApiKey("Bearer nope")).rejects.toMatchObject({ status: 401 });
    });

    it("bilinmeyen veya iptal edilmiş anahtar 401", async () => {
      db.apiKey.findUnique.mockResolvedValue(null);
      await expect(authenticateApiKey(`Bearer ${key}`)).rejects.toMatchObject({ status: 401 });
      db.apiKey.findUnique.mockResolvedValue({ id: "k", revokedAt: new Date(), user: { plan: "PRO" } });
      await expect(authenticateApiKey(`Bearer ${key}`)).rejects.toMatchObject({ status: 401 });
    });

    it("planı Free'ye düşen kullanıcının anahtarı çalışmaz (402)", async () => {
      db.apiKey.findUnique.mockResolvedValue({ id: "k", revokedAt: null, lastUsedAt: null, user: { id: "u", plan: "FREE" } });
      await expect(authenticateApiKey(`Bearer ${key}`)).rejects.toMatchObject({ status: 402 });
    });

    it("geçerli anahtar sahibini döndürür ve özetle aranır", async () => {
      const user = { id: "u", plan: "PRO" };
      db.apiKey.findUnique.mockResolvedValue({ id: "k-valid", revokedAt: null, lastUsedAt: new Date(), user });
      await expect(authenticateApiKey(`Bearer ${key}`)).resolves.toBe(user);
      expect(db.apiKey.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { hash: sha256(key) } }));
    });

    it("anahtar başına dakikada 60 istekten sonra 429", async () => {
      db.apiKey.findUnique.mockResolvedValue({ id: "k-limited", revokedAt: null, lastUsedAt: new Date(), user: { id: "u", plan: "PRO" } });
      for (let i = 0; i < 60; i++) await authenticateApiKey(`Bearer ${key}`);
      await expect(authenticateApiKey(`Bearer ${key}`)).rejects.toMatchObject({ status: 429 });
    });
  });
});
