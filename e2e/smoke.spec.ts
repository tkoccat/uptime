import { expect, test } from "@playwright/test";

// Hizmet bağımlılığı olmayan duman testleri

test("ana sayfa ve fiyat tablosu açılır, aylık/yıllık geçişi çalışır", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Website monitoring");
  await page.goto("/pricing");
  await expect(page.getByText("£9").first()).toBeVisible();
  await page.getByRole("button", { name: /Yearly/ }).click();
  await expect(page.getByText("£86")).toBeVisible();
});

for (const [prefix, text] of [
  ["/de", "Website-Monitoring"],
  ["/fr", "Surveillance de sites web"],
  ["/tr", "web sitesi izleme"],
] as const) {
  test(`${prefix} dilinde ana sayfa çevrilmiş görünür`, async ({ page }) => {
    await page.goto(prefix);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(text);
    await expect(page.locator("html")).toHaveAttribute("lang", prefix.slice(1));
  });
}

test("korumalı sayfalar girişe yönlendirir (dil ön eki korunur)", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.goto("/tr/dashboard");
  await expect(page).toHaveURL(/\/tr\/login\?next=/);
});

test("çerez banner'ı reddet/kabul seçeneklerini eşit sunar ve tercihi hatırlar", async ({ page }) => {
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Cookie preferences" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Reject non-essential" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Accept all" })).toBeVisible();
  await dialog.getByRole("button", { name: "Reject non-essential" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(dialog).toBeHidden();
});

test("yasal sayfalar taslak uyarısıyla açılır", async ({ page }) => {
  for (const path of ["/terms", "/privacy", "/cookies", "/refunds", "/dpa", "/sub-processors"]) {
    await page.goto(path);
    await expect(page.getByRole("note")).toContainText("Draft template");
  }
});

test("karşılaştırma sayfaları dört dilde açılır", async ({ page }) => {
  for (const slug of ["better-stack", "uptimerobot", "cronitor", "uptime-kuma"]) {
    const res = await page.goto(`/de/alternatives/${slug}`);
    expect(res?.status()).toBe(200);
  }
});

test("kayıt formu hata kodunu yerelleştirilmiş gösterir", async ({ page }) => {
  await page.goto("/tr/register?error=weak_password");
  await expect(page.getByRole("alert")).toContainText("en az 8 karakter");
});
