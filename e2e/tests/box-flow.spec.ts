import { test, expect, Page } from '@playwright/test';

// Helper to create and login with a new account
async function createAccountAndLogin(page: Page) {
  await page.goto('/account/create');
  await page.getByRole('button', { name: /创建账户/i }).click();
  await expect(page.getByText(/请妥善保存/i)).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: /已备份/i }).click();
  await expect(page).toHaveURL(/\/(dashboard|boxes)/, { timeout: 10000 });
}

test.describe('Box Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await createAccountAndLogin(page);
  });

  test('should create a new box', async ({ page }) => {
    // Navigate to boxes page
    await page.goto('/boxes');
    
    // Click create box button
    await page.getByRole('button', { name: /创建/i }).click();
    
    // Fill in box slug
    const slugInput = page.getByPlaceholder(/输入.*slug/i);
    if (await slugInput.isVisible()) {
      await slugInput.fill('test-box-' + Date.now());
    }
    
    // Submit
    await page.getByRole('button', { name: /确认|创建|提交/i }).click();
    
    // Should see success or box list with new box
    await expect(page.getByText(/test-box|成功|创建/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Question Submission Flow', () => {
  test('should display box page and allow question submission', async ({ page }) => {
    // This test requires a box to exist - create one first
    await createAccountAndLogin(page);
    await page.goto('/boxes');
    
    // Create a box with a unique slug
    const boxSlug = 'e2e-test-' + Date.now();
    await page.getByRole('button', { name: /创建/i }).click();
    
    const slugInput = page.getByPlaceholder(/输入.*slug/i);
    if (await slugInput.isVisible()) {
      await slugInput.fill(boxSlug);
    }
    await page.getByRole('button', { name: /确认|创建|提交/i }).click();
    
    // Wait for box to be created
    await page.waitForTimeout(2000);
    
    // Open a new context (simulating anonymous user)
    const context = await page.context().browser()!.newContext();
    const anonPage = await context.newPage();
    
    // Visit the box as anonymous user
    await anonPage.goto(`/box/${boxSlug}`);
    
    // Check if box page loads
    const heading = anonPage.locator('h1');
    await expect(heading).toContainText(/提问|${boxSlug}/i, { timeout: 10000 });
    
    // Enter a question
    const questionInput = anonPage.locator('textarea');
    await questionInput.fill('This is a test question from E2E test');
    
    // Submit
    await anonPage.getByRole('button', { name: /提交/i }).click();
    
    // Should see success message with receipt
    await expect(anonPage.getByText(/成功|回执/i)).toBeVisible({ timeout: 10000 });
    
    await context.close();
  });
});
