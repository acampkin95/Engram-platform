import { test, expect } from '@playwright/test';

test.describe('Navigation — Desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('crawl4ai_onboarding_complete', 'true');
    });
    await page.goto('/');
    await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();
  });

  test('main navigation bar is visible', async ({ page }) => {
    await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();
  });

  test('logo renders as a link to home', async ({ page }) => {
    const logo = page.locator('a[href="/"]').filter({ hasText: /crawl4ai/i }).first();
    await expect(logo).toBeVisible();
  });

  test('Dashboard nav item is visible', async ({ page }) => {
    await expect(page.locator('.hidden.sm\\:block').getByRole('link', { name: /Dashboard/i })).toBeVisible();
  });

  test('OSINT nav item is visible', async ({ page }) => {
    await expect(page.locator('.hidden.sm\\:block').getByRole('link', { name: /OSINT/i })).toBeVisible();
  });

  test('Storage nav item is visible', async ({ page }) => {
    await expect(page.locator('.hidden.sm\\:block').getByRole('link', { name: /Storage/i })).toBeVisible();
  });

  test('Crawl dropdown button is visible', async ({ page }) => {
    await expect(
      page.locator('button[aria-haspopup="true"]', { hasText: /Crawl/i }),
    ).toBeVisible();
  });

  test('clicking Crawl dropdown reveals sub-items', async ({ page }) => {
    await page.locator('button[aria-haspopup="true"]', { hasText: /Crawl/i }).first().click();
    await expect(page.getByRole('link', { name: /New Crawl/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('link', { name: /Active Crawls/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /History/i })).toBeVisible();
  });

  test('clicking Tools dropdown reveals sub-items', async ({ page }) => {
    await page.locator('button[aria-haspopup="true"]', { hasText: /Tools/i }).first().click();
    await expect(page.getByRole('link', { name: /Extraction Builder/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('link', { name: /RAG Pipeline/i })).toBeVisible();
  });

  test('clicking OSINT nav item navigates to /osint', async ({ page }) => {
    await page.locator('.hidden.sm\\:block a[href="/osint"]').click();
    await expect(page).toHaveURL(/\/osint/);
  });

  test('clicking Settings nav item navigates to /settings', async ({ page }) => {
    await page.locator('.hidden.sm\\:block a[href="/settings"]').click();
    await expect(page).toHaveURL(/\/settings/);
  });

  test('clicking logo navigates to home', async ({ page }) => {
    await page.goto('/osint');
    await page.locator('a[href="/"]').filter({ hasText: /crawl4ai/i }).first().click();
    await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('Navigation — Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('crawl4ai_onboarding_complete', 'true');
    });
    await page.goto('/');
    await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();
  });

  test('hamburger menu button is visible at mobile viewport', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Toggle menu/i })).toBeVisible();
  });

  test('desktop nav items are hidden at mobile viewport', async ({ page }) => {
    const desktopNav = page.locator('.hidden.sm\\:block');
    await expect(desktopNav).toBeHidden();
  });

  test('clicking hamburger opens mobile menu', async ({ page }) => {
    await page.getByRole('button', { name: /Toggle menu/i }).click();
    await expect(page.locator('.sm\\:hidden').filter({ hasNot: page.locator('button[aria-label="Toggle menu"]') }).getByRole('link', { name: /Dashboard/i })).toBeVisible({ timeout: 5_000 });
  });

  test('mobile menu shows OSINT nav link', async ({ page }) => {
    await page.getByRole('button', { name: /Toggle menu/i }).click();
    const mobileMenu = page.locator('.sm\\:hidden').last();
    await expect(mobileMenu.getByRole('link', { name: /OSINT/i })).toBeVisible({ timeout: 5_000 });
  });

  test('clicking a mobile nav link closes the menu and navigates', async ({ page }) => {
    await page.getByRole('button', { name: /Toggle menu/i }).click();
    const mobileMenu = page.locator('.sm\\:hidden').last();
    await mobileMenu.getByRole('link', { name: /OSINT/i }).click();
    await expect(page).toHaveURL(/\/osint/);
  });
});
