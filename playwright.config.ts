import { defineConfig, devices } from "@playwright/test";

// E2E testleri: `npm run test:e2e`
// - smoke.spec.ts: hizmet gerektirmez (yalnızca pazarlama sayfaları ve yönlendirmeler)
// - full-flow.spec.ts: gerçek Supabase/Stripe TEST ortamı ister; E2E_* değişkenleri yoksa atlanır
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // E2E_BASE_URL verilmediyse üretim derlemesi yerelde başlatılır
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run build && npm run start -- -p 3100",
        url: "http://localhost:3100",
        timeout: 300_000,
        reuseExistingServer: true,
        env: {
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "anon",
        },
      },
});
