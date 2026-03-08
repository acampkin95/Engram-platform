import { test, expect } from '@playwright/test';

test.describe('Error States', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('crawl4ai_onboarding_complete', 'true');
    });
  });

  test.describe('Unknown Routes', () => {
    test('navigating to a non-existent route keeps the layout visible', async ({ page }) => {
      await page.goto('/this-route-does-not-exist-42xq');
      await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible({ timeout: 10_000 });
    });

    test('navigating to unknown route keeps #main-content present', async ({ page }) => {
      await page.goto('/not-a-real-page');
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 10_000 });
    });

    test('unknown route does not throw uncaught JS errors', async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      await page.goto('/totally/unknown/deeply/nested/path');
      await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible({ timeout: 10_000 });

      expect(pageErrors, `Uncaught errors: ${pageErrors.join('; ')}`).toHaveLength(0);
    });
  });

  test.describe('Offline Banner', () => {
    test('offline banner appears when the browser goes offline', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();

      await page.context().setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));

      await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5_000 });
    });

    test('offline banner contains "You are offline" message', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();

      await page.context().setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));

      await expect(page.locator('[role="alert"]')).toContainText('You are offline', { timeout: 5_000 });
    });

    test('offline banner dismiss button closes the banner', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();

      await page.context().setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));

      await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5_000 });

      await page.getByRole('button', { name: /Dismiss offline notification/i }).click();

      await expect(page.locator('[role="alert"]')).not.toBeVisible();
    });

    test('offline banner disappears after going back online', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible();

      await page.context().setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5_000 });

      await page.context().setOffline(false);
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      await expect(page.locator('[role="alert"]')).not.toBeVisible({ timeout: 5_000 });
    });
  });
});
