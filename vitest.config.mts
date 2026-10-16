import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
    env: {
      // Şifreleme testleri için sabit test anahtarı (gerçek bir sır değildir)
      APP_ENCRYPTION_KEY: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
    },
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
});
