import { describe, expect, it, vi } from "vitest";
import { RateLimitError } from "./errors";
import { MemoryStore, enforceRateLimit, rateLimit, type RateLimitStore } from "./rate-limit";

describe("rate limit", () => {
  it("limite kadar izin verir, sonrasında engeller", async () => {
    const store = new MemoryStore();
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit("k", 3, 60, store));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(results[0].remaining).toBe(2);
    expect(results[3].remaining).toBe(0);
  });

  it("anahtarlar birbirinden bağımsızdır", async () => {
    const store = new MemoryStore();
    await rateLimit("a", 1, 60, store);
    expect((await rateLimit("a", 1, 60, store)).ok).toBe(false);
    expect((await rateLimit("b", 1, 60, store)).ok).toBe(true);
  });

  it("pencere dolunca sayaç sıfırlanır", async () => {
    vi.useFakeTimers();
    const store = new MemoryStore();
    await rateLimit("k", 1, 10, store);
    expect((await rateLimit("k", 1, 10, store)).ok).toBe(false);
    vi.advanceTimersByTime(11_000);
    expect((await rateLimit("k", 1, 10, store)).ok).toBe(true);
    vi.useRealTimers();
  });

  it("enforceRateLimit aşımda RateLimitError (Retry-After ile) fırlatır", async () => {
    const store = new MemoryStore();
    await enforceRateLimit("x", 1, 30, store);
    await expect(enforceRateLimit("x", 1, 30, store)).rejects.toMatchObject({
      status: 429,
      retryAfterSec: expect.any(Number),
    });
    await expect(enforceRateLimit("x", 1, 30, store)).rejects.toBeInstanceOf(RateLimitError);
  });

  it("depo hata verirse bellek içi sayaca düşer ve hizmeti durdurmaz", async () => {
    const broken: RateLimitStore = { hit: () => Promise.reject(new Error("redis down")) };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await rateLimit("fallback-key", 5, 60, broken);
    expect(res.ok).toBe(true);
  });
});
