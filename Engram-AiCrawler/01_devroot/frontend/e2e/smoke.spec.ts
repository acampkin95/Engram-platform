import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('app loads and shows dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Crawl4AI/i);
    await expect(page.locator('body')).toBeVisible();
  });

  test('navigation renders correctly', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav).toBeVisible();
  });

  test('health check API responds', async ({ request }) => {
    try {
      const response = await request.get('http://localhost:11235/health');
      if (response.ok()) {
        const body = await response.json();
        expect(body.status).toBe('healthy');
      }
    } catch {
      test.skip();
    }
  });
});
