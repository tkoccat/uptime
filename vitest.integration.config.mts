import path from "node:path";
import { defineConfig } from "vitest/config";

// Entegrasyon testleri: gerçek bir PostgreSQL'e (embedded-postgres, Docker gerekmez) karşı çalışır.
// Migration'lar boş bir veritabanına sırayla uygulanır; ardından iş mantığı gerçek Prisma ile sınanır.
//   npm run test:int
const PORT = 54329;
const URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/saas_test`;

export default defineConfig({
  // tsconfig'te jsx: preserve olduğundan e-posta şablonları (.tsx) testte de derlenebilsin
  esbuild: { jsx: "automatic" },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: ["test/integration/**/*.int.test.ts"],
    globalSetup: ["test/integration/global-setup.ts"],
    setupFiles: ["test/integration/setup.ts"],
    // Tek veritabanını paylaştıkları için dosyalar sırayla çalışır
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    env: {
      DATABASE_URL: URL,
      DIRECT_URL: URL,
      APP_ENCRYPTION_KEY: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
      NEXT_PUBLIC_APP_URL: "https://app.test",
      UPTIME_KUMA_URL: "http://kuma.test:3001",
      UPTIME_KUMA_ADMIN_USERNAME: "test-admin",
      UPTIME_KUMA_ADMIN_PASSWORD: "test-password",
      STRIPE_PRICE_ID_PRO_MONTHLY: "price_pro_m",
      STRIPE_PRICE_ID_PRO_YEARLY: "price_pro_y",
      STRIPE_PRICE_ID_BUSINESS_MONTHLY: "price_biz_m",
      STRIPE_PRICE_ID_BUSINESS_YEARLY: "price_biz_y",
      ADMIN_EMAIL: "boss@test.dev",
    },
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
});
