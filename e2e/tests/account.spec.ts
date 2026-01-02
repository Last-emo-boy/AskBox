import { test, expect } from '@playwright/test';

test.describe('Account Creation Flow', () => {
  test('should create a new account without password', async ({ page }) => {
    await page.goto('/account/create');
    
    // Check the form is displayed
    await expect(page.locator('h1')).toContainText('创建账户');
    
    // Leave password empty and click create
    await page.getByRole('button', { name: /创建账户/i }).click();
    
    // Should show the seed backup screen
    await expect(page.getByText(/请妥善保存/i)).toBeVisible({ timeout: 10000 });
    
    // Seed should be displayed (24+ character base64 string)
    const seedElement = page.locator('.font-mono');
    await expect(seedElement).toBeVisible();
    const seedText = await seedElement.textContent();
    expect(seedText?.length).toBeGreaterThan(20);
  });

  test('should create a new account with password', async ({ page }) => {
    await page.goto('/account/create');
    
    // Enter a password
    const passwordInput = page.getByPlaceholder(/输入口令/i);
    await passwordInput.fill('test-password-123');
    
    // Click create
    await page.getByRole('button', { name: /创建账户/i }).click();
    
    // Should show success
    await expect(page.getByText(/请妥善保存/i)).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to dashboard after confirming seed backup', async ({ page }) => {
    await page.goto('/account/create');
    
    // Create account
    await page.getByRole('button', { name: /创建账户/i }).click();
    
    // Wait for seed display
    await expect(page.getByText(/请妥善保存/i)).toBeVisible({ timeout: 10000 });
    
    // Confirm backup
    await page.getByRole('button', { name: /已备份/i }).click();
    
    // Should navigate to dashboard or boxes page
    await expect(page).toHaveURL(/\/(dashboard|boxes)/);
  });
});

test.describe('Account Import Flow', () => {
  test('should show import form', async ({ page }) => {
    await page.goto('/account/import');
    
    await expect(page.locator('h1')).toContainText('导入账户');
    await expect(page.getByPlaceholder(/输入种子/i)).toBeVisible();
  });

  test('should validate seed format', async ({ page }) => {
    await page.goto('/account/import');
    
    // Enter invalid seed
    const seedInput = page.getByPlaceholder(/输入种子/i);
    await seedInput.fill('invalid-seed');
    
    // Try to import
    await page.getByRole('button', { name: /导入/i }).click();
    
    // Should show error
    await expect(page.getByText(/无效|错误|失败/i)).toBeVisible({ timeout: 5000 });
  });
});
