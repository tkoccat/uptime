import { afterAll } from "vitest";
import { prisma } from "@/lib/prisma";

// Test dosyası bitince bağlantıyı kapat: aksi halde süreç çıkamaz
afterAll(async () => {
  await prisma.$disconnect();
});
