import { test, expect } from '@playwright/test';

test.describe('Account Creation Flow', () => {
  test('should create a new account without password', async ({ page }) => {
    await page.goto('/account/create');

    // Check the form is displayed
    await expect(page.getByText('创建新账户')).toBeVisible();

    // Uncheck password protection
    await page.getByLabel(/使用密码保护/i).uncheck();

    // Click create
    await page.getByRole('button', { name: /创建账户/i }).click();

    // Should navigate to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('should create a new account with password', async ({ page }) => {
    await page.goto('/account/create');

    // Password protection is enabled by default
    // Enter password
    await page.getByLabel('设置密码').fill('test-password-123');
    await page.getByLabel('确认密码').fill('test-password-123');

    // Click create
    await page.getByRole('button', { name: /创建账户/i }).click();

    // Should navigate to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('should show password validation error', async ({ page }) => {
    await page.goto('/account/create');

    // Enter short password
    await page.getByLabel('设置密码').fill('short');
    await page.getByLabel('确认密码').fill('short');

    // Click create
    await page.getByRole('button', { name: /创建账户/i }).click();

    // Should show error
    await expect(page.getByText(/至少需要 8 个字符/i)).toBeVisible();
  });
});

test.describe('Account Import Flow', () => {
  test('should show import form', async ({ page }) => {
    await page.goto('/account/import');

    await expect(page.getByText('导入账户')).toBeVisible();
    await expect(page.getByLabel('输入种子')).toBeVisible();
  });

  test('should validate seed format', async ({ page }) => {
    await page.goto('/account/import');

    // Enter invalid seed
    await page.getByLabel('输入种子').fill('invalid-seed');

    // Uncheck password protection for simpler test
    await page.getByLabel(/使用密码保护/i).uncheck();

    // Try to import
    await page.getByRole('button', { name: /导入账户/i }).click();

    // Should show error
    await expect(page.getByText(/无效|错误|失败/i)).toBeVisible({ timeout: 5000 });
  });
});
