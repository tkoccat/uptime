import { describe, expect, it } from "vitest";
import { authenticateApiKey, createApiKey, revokeApiKey } from "@/lib/api-keys";
import { sha256 } from "@/lib/crypto";
import { NotFoundError, PlanLimitError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { mkUser } from "./helpers";

describe("API anahtarları (gerçek veritabanı)", () => {
  it("Free plan anahtar oluşturamaz; Pro oluşturur, yalnızca özet saklanır", async () => {
    const free = await mkUser("FREE");
    await expect(createApiKey(free.id, "ci")).rejects.toBeInstanceOf(PlanLimitError);

    const pro = await mkUser("PRO");
    const { key } = await createApiKey(pro.id, "ci");
    const row = await prisma.apiKey.findFirstOrThrow({ where: { userId: pro.id } });
    expect(row.hash).toBe(sha256(key));
    expect(row.prefix).toBe(key.slice(0, 12));
    expect(JSON.stringify(row)).not.toContain(key);
  });

  it("geçerli anahtar kullanıcıyı döndürür ve son kullanımı kaydeder", async () => {
    const pro = await mkUser("PRO");
    const { key } = await createApiKey(pro.id, "ci");
    const user = await authenticateApiKey(`Bearer ${key}`);
    expect(user.id).toBe(pro.id);
    expect((await prisma.apiKey.findFirstOrThrow({ where: { userId: pro.id } })).lastUsedAt).not.toBeNull();
  });

  it("iptal edilmiş, bilinmeyen, askıya alınmış veya planı düşmüş hesabın anahtarı reddedilir", async () => {
    const pro = await mkUser("PRO");
    const { key, id } = await createApiKey(pro.id, "ci");

    await expect(authenticateApiKey(`Bearer upk_${"x".repeat(43)}`)).rejects.toMatchObject({ status: 401 });

    await prisma.user.update({ where: { id: pro.id }, data: { suspendedAt: new Date() } });
    await expect(authenticateApiKey(`Bearer ${key}`)).rejects.toMatchObject({ status: 403 });
    await prisma.user.update({ where: { id: pro.id }, data: { suspendedAt: null, plan: "FREE" } });
    await expect(authenticateApiKey(`Bearer ${key}`)).rejects.toMatchObject({ status: 402 });
    await prisma.user.update({ where: { id: pro.id }, data: { plan: "PRO" } });
    await expect(authenticateApiKey(`Bearer ${key}`)).resolves.toBeTruthy();

    await revokeApiKey(pro.id, id);
    await expect(authenticateApiKey(`Bearer ${key}`)).rejects.toMatchObject({ status: 401 });
  });

  it("başkasının anahtarı iptal edilemez; aktif anahtar sayısı sınırlıdır", async () => {
    const a = await mkUser("PRO");
    const b = await mkUser("PRO");
    const { id } = await createApiKey(a.id, "a-key");
    await expect(revokeApiKey(b.id, id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await prisma.apiKey.findUniqueOrThrow({ where: { id } })).revokedAt).toBeNull();

    for (let i = 0; i < 9; i++) await createApiKey(a.id, `k${i}`);
    await expect(createApiKey(a.id, "eleventh")).rejects.toMatchObject({ code: "validation" });
  });
});
