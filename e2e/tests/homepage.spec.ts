import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should display the homepage', async ({ page }) => {
    await page.goto('/');

    // Check main heading
    await expect(page.locator('h1')).toContainText('AskBox');

    // Check navigation links exist
    await expect(page.getByRole('link', { name: /创建账户/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /导入账户/i })).toBeVisible();
  });

  test('should navigate to create account page', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: /创建账户/i }).click();

    await expect(page).toHaveURL('/account/create');
    // Page title is in CardTitle, not h1
    await expect(page.getByText('创建新账户')).toBeVisible();
  });

  test('should navigate to import account page', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: /导入账户/i }).click();

    await expect(page).toHaveURL('/account/import');
    // Page title is in CardTitle, not h1
    await expect(page.getByText('导入账户')).toBeVisible();
  });
});
