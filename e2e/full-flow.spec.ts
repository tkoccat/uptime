import { expect, test } from "@playwright/test";

// Uçtan uca akış: giriş -> monitör ekle -> ödeme (Stripe TEST modu) -> iptal.
//
// Gerçek bir staging ortamı gerektirir (Supabase, Uptime Kuma, Stripe test anahtarları, Redis, Postgres):
//   E2E_BASE_URL       staging adresi (örn. https://staging.siten.com)
//   E2E_USER_EMAIL     e-postası ÖNCEDEN doğrulanmış test kullanıcısı
//   E2E_USER_PASSWORD  test kullanıcısının şifresi
// Yalnızca Stripe TEST kartı (4242 4242 4242 4242) kullanılır; canlı anahtarlarla ÇALIŞTIRMAYIN.
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const enabled = Boolean(process.env.E2E_BASE_URL && email && password);

test.describe("tam akış", () => {
  test.skip(!enabled, "E2E_BASE_URL, E2E_USER_EMAIL ve E2E_USER_PASSWORD gerekli");
  test.describe.configure({ mode: "serial" });

  const monitorName = `e2e-${Date.now()}`;

  test("giriş yapar", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("monitör ekler ve listede görür", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.goto("/dashboard/monitors");
    await page.getByRole("button", { name: "New monitor" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(monitorName);
    await dialog.getByLabel("URL or host").fill("https://example.com");
    await dialog.getByRole("button", { name: "Add monitor" }).click();
    await expect(page.getByRole("link", { name: monitorName })).toBeVisible();
  });

  test("iç ağ adresi reddedilir (SSRF koruması)", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.goto("/dashboard/monitors");
    await page.getByRole("button", { name: "New monitor" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("internal");
    await dialog.getByLabel("URL or host").fill("http://169.254.169.254/latest/meta-data");
    await dialog.getByRole("button", { name: "Add monitor" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("Pro planı Stripe test kartıyla satın alır", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.goto("/dashboard/billing");
    await page.getByRole("button", { name: /Choose Pro/ }).click();
    await page.waitForURL(/checkout\.stripe\.com/);

    // Stripe Checkout alan adları sürümler arasında değişebilir; gerekirse güncelleyin
    await page.getByLabel(/Card number/i).fill("4242424242424242");
    await page.getByLabel(/Expiration/i).fill("12 / 34");
    await page.getByLabel(/CVC/i).fill("123");
    await page.getByLabel(/Cardholder name/i).fill("E2E Test");
    await page.getByRole("button", { name: /Start trial|Subscribe/i }).click();

    await page.waitForURL(/\/dashboard\/billing\?checkout=success/, { timeout: 60_000 });
    await expect(page.getByText("Thank you")).toBeVisible();
  });

  test("aboneliği müşteri portalından iptal eder", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.goto("/dashboard/billing");
    await page.getByRole("button", { name: "Manage subscription and invoices" }).click();
    await page.waitForURL(/billing\.stripe\.com/);
    await page.getByRole("link", { name: /Cancel (plan|subscription)/i }).click();
    await page.getByRole("button", { name: /Cancel (plan|subscription)/i }).click();
    await expect(page.getByText(/cancel/i).first()).toBeVisible();
  });

  test("temizlik: test monitörünü siler", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.goto("/dashboard/monitors");
    await page.getByRole("link", { name: monitorName }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete monitor" }).click();
    await expect(page.getByRole("link", { name: monitorName })).toHaveCount(0);
  });
});
