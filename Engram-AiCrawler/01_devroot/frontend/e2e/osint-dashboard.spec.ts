import { test, expect } from '@playwright/test';

test.describe('OSINT Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('crawl4ai_onboarding_complete', 'true');
    });
    await page.goto('/osint');
    await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();
  });

  test('shows OSINT Operations heading', async ({ page }) => {
    await expect(
      page.locator('h1', { hasText: 'OSINT Operations' }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('shows all four tab buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Alias Discovery/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Reverse Image/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Full Scan/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Batch Scan/i })).toBeVisible();
  });

  test('Alias Discovery tab is active by default and shows username input', async ({ page }) => {
    const input = page.getByPlaceholder('Enter username to search...');
    await expect(input).toBeVisible({ timeout: 10_000 });
  });

  test('Alias Discovery tab shows a Search button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^Search$/ })).toBeVisible({ timeout: 10_000 });
  });

  test('switching to Full Scan tab shows username input field', async ({ page }) => {
    await page.getByRole('button', { name: /Full Scan/i }).click();
    await expect(
      page.getByPlaceholder('Enter username (e.g., johndoe123)'),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Full Scan tab shows Start Scan button', async ({ page }) => {
    await page.getByRole('button', { name: /Full Scan/i }).click();
    await expect(page.getByRole('button', { name: /Start Scan/i })).toBeVisible({ timeout: 10_000 });
  });

  test('switching to Reverse Image tab shows file upload area', async ({ page }) => {
    await page.getByRole('button', { name: /Reverse Image/i }).click();
    await expect(
      page.locator('text=Upload image or drop file'),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('filter bar with platform selector is always visible', async ({ page }) => {
    await expect(page.locator('select')).toBeVisible({ timeout: 10_000 });
  });

  test('Export JSON button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Export JSON/i })).toBeVisible({ timeout: 10_000 });
  });

  test('result count badge is visible in filter bar', async ({ page }) => {
    // Use a precise regex so we match "N results" badge, not "Alias Results"
    // or "No results found" elsewhere on the page.
    await expect(page.getByText(/^\d+ results$/)).toBeVisible({ timeout: 10_000 });
  });
});
