import type { Plan } from "@prisma/client";
import { prisma } from "@/lib/prisma";

let n = 0;

/** Benzersiz e-posta/supabase kimliğiyle kullanıcı oluşturur. */
export async function mkUser(plan: Plan = "FREE", over: Record<string, unknown> = {}) {
  n += 1;
  return prisma.user.create({
    data: { email: `user${n}-${Date.now()}@test.dev`, supabaseId: `sb-${n}-${Date.now()}`, plan, ...over },
  });
}

/** Doğrudan veritabanına monitör ekler (Kuma'ya dokunmadan). */
export async function mkMonitor(userId: string, over: Record<string, unknown> = {}) {
  n += 1;
  return prisma.monitor.create({
    data: {
      userId,
      // Test dosyaları aynı veritabanını paylaşır: benzersiz alan dosyalar arasında çakışmasın
      uptimeKumaMonitorId: 1_000_000 + Math.floor(Math.random() * 1_000_000_000),
      name: `m${n}`,
      url: `https://example${n}.com`,
      type: "HTTP",
      interval: 180,
      ...over,
    },
  });
}
