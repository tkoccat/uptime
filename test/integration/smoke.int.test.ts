import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

describe("veritabanı ve migration'lar", () => {
  it("tüm migration'lar boş veritabanına uygulanır ve tablolar kullanılabilir", async () => {
    // Dosyalar aynı veritabanını paylaşır: sayı değil, sorguların hatasız çalışması doğrulanır
    for (const table of ["user", "monitor", "planConfig", "siteSetting", "siteContent", "stripeEvent", "apiKey", "incident", "monitorDaily"] as const) {
      expect(await (prisma[table] as unknown as { count: () => Promise<number> }).count()).toBeGreaterThanOrEqual(0);
    }
  });

  it("enum değerleri (HEARTBEAT, DISCORD, TELEGRAM, TEAMS) kabul edilir", async () => {
    const u = await prisma.user.create({ data: { email: "enum@test.dev", supabaseId: "sb-enum" } });
    await prisma.monitor.create({ data: { userId: u.id, uptimeKumaMonitorId: 9001, name: "hb", url: "heartbeat", type: "HEARTBEAT", pingToken: "A".repeat(32) } });
    for (const type of ["DISCORD", "TELEGRAM", "TEAMS"] as const) {
      await prisma.notificationChannel.create({ data: { userId: u.id, type, name: type, config: { enc: "x" } } });
    }
    expect(await prisma.notificationChannel.count({ where: { userId: u.id } })).toBe(3);
    await prisma.user.delete({ where: { id: u.id } });
  });
});
