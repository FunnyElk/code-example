import { expect, Page } from "@playwright/test";

export async function login(page: Page, user: string, pass: string) {
  await page.goto("/lk/");

  await page.locator("#email").fill(user);
  await page.locator("#password").fill(pass);

  const submit = page.locator('button[type="submit"]', { hasText: "Войти" });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText("Выход")).toBeVisible({ timeout: 60_000 });
}

export async function logout(page: Page) {
  await page.getByText("Выход", { exact: true }).click();

  const dialog = page.locator(".ant-modal-confirm[role='dialog']").first();

  await expect(dialog).toBeVisible({ timeout: 30_000 });

  const ok = dialog.getByRole("button", { name: /^ok$/i });
  await expect(ok).toBeEnabled({ timeout: 30_000 });

  await ok.click();

  await expect(dialog).toHaveCount(0, { timeout: 60_000 });
}
