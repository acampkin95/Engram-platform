import { test, expect } from '@playwright/test';

test.describe('Crawl Config Page (/crawl/new)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('crawl4ai_onboarding_complete', 'true');
    });
    await page.goto('/crawl/new');
    await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();
  });

  test('shows New Crawl heading', async ({ page }) => {
    await expect(page.locator('h1', { hasText: 'New Crawl' })).toBeVisible({ timeout: 15_000 });
  });

  test('Start Crawl button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Start Crawl/i })).toBeVisible({ timeout: 10_000 });
  });

  test('Reset button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Reset/i })).toBeVisible({ timeout: 10_000 });
  });

  test('URL(s) section heading is visible', async ({ page }) => {
    await expect(page.locator('h2', { hasText: "URL(s)" })).toBeVisible({ timeout: 10_000 });
  });

  test('Extraction Strategy section heading is visible', async ({ page }) => {
    await expect(page.locator('h2', { hasText: 'Extraction Strategy' })).toBeVisible({ timeout: 10_000 });
  });

  test('Start Crawl button is enabled before submission', async ({ page }) => {
    const startBtn = page.getByRole('button', { name: /Start Crawl/i });
    await expect(startBtn).toBeVisible({ timeout: 10_000 });
    await expect(startBtn).not.toBeDisabled();
  });

  test('clicking Reset button does not crash the page', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Reset/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Reset/i }).click();
    await expect(page.locator('h1', { hasText: 'New Crawl' })).toBeVisible();
  });
});
