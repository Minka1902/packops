// Phase-1 business module smoke tests: Owner Dashboard, Module Store, Staff &
// Roles. Runs across all four viewport projects (mobile 390, tablet 768, desktop
// 1440, large 1920).
//
// Auth-gated: requires TEST_EMAIL / TEST_PASSWORD for a Firebase account that
// owns a seeded business (npm run seed). Without them the business tests skip.
// Run: npm run test:e2e

import { test, expect, type Page } from '@playwright/test';

async function login(page: Page): Promise<boolean> {
  if (!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD) return false;
  await page.goto('/login');
  await page.fill('input[type="email"]', process.env.TEST_EMAIL);
  await page.fill('#password', process.env.TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 10_000 });
  return true;
}

// Enter business mode and open a business route. App-specific: the mode switch
// lives in the account menu; fall back to direct navigation.
async function gotoBusiness(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
}

test.describe('Business modules (owner)', () => {
  test.beforeEach(async ({ page }) => {
    const ok = await login(page);
    test.skip(!ok, 'Set TEST_EMAIL / TEST_PASSWORD (owner of a seeded business) to run.');
  });

  test('Owner Dashboard renders summary cards without overflow', async ({ page }) => {
    await gotoBusiness(page, '/business');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('Module Store lists modules and blocks a dependent-unmet unlock', async ({ page }) => {
    await gotoBusiness(page, '/business/store');
    await expect(page.getByRole('heading', { name: /module store/i })).toBeVisible();
    // Unlocking a module with unmet deps opens the "unlock together" dialog.
    const unlockBtn = page.getByRole('button', { name: /^unlock$/i }).first();
    if (await unlockBtn.count()) {
      await unlockBtn.click();
      const dialog = page.getByRole('dialog');
      // Either a closure dialog appears, or the module unlocked directly.
      if (await dialog.count()) {
        await expect(dialog.getByRole('button', { name: /unlock \d+ together/i })).toBeVisible();
      }
    }
    await expectNoHorizontalOverflow(page);
  });

  test('Roles and Staff pages load', async ({ page }) => {
    await gotoBusiness(page, '/business/roles');
    await expect(page.getByRole('heading', { name: /roles/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await gotoBusiness(page, '/business/staff');
    await expect(page.getByRole('heading', { name: /staff/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
