import { test, expect, Page } from '@playwright/test';

// Helper to create and login with a new account (without password for simpler testing)
async function createAccountAndLogin(page: Page) {
  await page.goto('/account/create');
  // Uncheck password protection for faster test
  await page.getByLabel(/使用密码保护/i).uncheck();
  await page.getByRole('button', { name: /创建账户/i }).click();
  // Now directly navigates to dashboard without seed backup step
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
}

test.describe('Box Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await createAccountAndLogin(page);
  });

  test('should create a new box', async ({ page }) => {
    // Navigate to boxes page
    await page.goto('/boxes');

    // Wait for page to load - should see the create section
    await expect(page.getByText('创建新提问箱')).toBeVisible({ timeout: 10000 });

    // Fill in box slug (optional)
    const slugInput = page.getByPlaceholder(/自定义链接/i);
    const boxSlug = 'test-box-' + Date.now();
    await slugInput.fill(boxSlug);

    // Click create button
    await page.getByRole('button', { name: /创建/i }).click();

    // Should see the new box in the list
    await expect(page.getByText(boxSlug)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Question Submission Flow', () => {
  test('should display box page and allow question submission', async ({ page }) => {
    // Create account first
    await createAccountAndLogin(page);

    // Navigate to boxes page
    await page.goto('/boxes');

    // Wait for page to load
    await expect(page.getByText('创建新提问箱')).toBeVisible({ timeout: 10000 });

    // Create a box with a unique slug
    const boxSlug = 'e2e-test-' + Date.now();
    await page.getByPlaceholder(/自定义链接/i).fill(boxSlug);
    await page.getByRole('button', { name: /创建/i }).click();

    // Wait for box to appear in list
    await expect(page.getByText(boxSlug)).toBeVisible({ timeout: 10000 });

    // Open a new context (simulating anonymous user)
    const context = await page.context().browser()!.newContext();
    const anonPage = await context.newPage();

    // Visit the box as anonymous user
    await anonPage.goto(`/box/${boxSlug}`);

    // Check if box page loads - look for question input
    const questionInput = anonPage.locator('textarea');
    await expect(questionInput).toBeVisible({ timeout: 10000 });

    // Enter a question
    await questionInput.fill('This is a test question from E2E test');

    // Submit
    await anonPage.getByRole('button', { name: /提交|发送/i }).click();

    // Should see success message
    await expect(anonPage.getByText(/成功|已发送|回执/i)).toBeVisible({ timeout: 10000 });

    await context.close();
  });
});
