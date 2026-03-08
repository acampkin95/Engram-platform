import { expect, test } from '@playwright/test';

/**
 * Smoke tests for deployed Engram Platform.
 * Tests against the live site for 404s, Mixed Content, and console errors.
 */

const _SETTLE_TIMEOUT = 20_000;
const SITE = 'https://memory.velocitydigi.com';

// Collect console errors across all tests
test.describe('Deployed Site — Console Error Audit', () => {
  test('memories page has no Mixed Content or 404 errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      errors.push(`PAGE ERROR: ${err.message}`);
    });

    // Listen for failed requests (404, 500, blocked)
    page.on('requestfailed', (req) => {
      errors.push(`REQUEST FAILED: ${req.url()} — ${req.failure()?.errorText}`);
    });

    await page.goto(`${SITE}/dashboard/memory/memories`, { waitUntil: 'networkidle' });
    // Wait for SWR data fetches to settle
    await page.waitForTimeout(5000);

    const mixedContent = errors.filter((e) => e.includes('Mixed Content'));
    const notFound = errors.filter((e) => e.includes('404'));
    const serverErrors = errors.filter((e) => e.includes('500'));

    console.log('=== ALL CONSOLE ERRORS ===');
    for (const err of errors) {
      console.log(`  ${err}`);
    }
    console.log(
      `=== SUMMARY: ${errors.length} total, ${mixedContent.length} mixed content, ${notFound.length} 404s, ${serverErrors.length} 500s ===`,
    );

    expect(mixedContent, 'No Mixed Content errors').toHaveLength(0);
    expect(notFound, 'No 404 errors').toHaveLength(0);
  });

  test('dashboard home has no 404 errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('requestfailed', (req) => {
      errors.push(`REQUEST FAILED: ${req.url()} — ${req.failure()?.errorText}`);
    });

    await page.goto(`${SITE}/dashboard/home`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    const notFound = errors.filter((e) => e.includes('404'));
    const mixedContent = errors.filter((e) => e.includes('Mixed Content'));

    console.log('=== DASHBOARD HOME ERRORS ===');
    for (const err of errors) {
      console.log(`  ${err}`);
    }

    expect(mixedContent, 'No Mixed Content errors').toHaveLength(0);
    expect(notFound, 'No 404 errors').toHaveLength(0);
  });

  test('crawler home has no 404 errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('requestfailed', (req) => {
      errors.push(`REQUEST FAILED: ${req.url()} — ${req.failure()?.errorText}`);
    });

    await page.goto(`${SITE}/dashboard/crawler/home`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    const notFound = errors.filter((e) => e.includes('404'));
    const mixedContent = errors.filter((e) => e.includes('Mixed Content'));

    console.log('=== CRAWLER HOME ERRORS ===');
    for (const err of errors) {
      console.log(`  ${err}`);
    }

    expect(mixedContent, 'No Mixed Content errors').toHaveLength(0);
    expect(notFound, 'No 404 errors').toHaveLength(0);
  });

  test('memory graph page has no 404 errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('requestfailed', (req) => {
      errors.push(`REQUEST FAILED: ${req.url()} — ${req.failure()?.errorText}`);
    });

    await page.goto(`${SITE}/dashboard/memory/graph`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    const notFound = errors.filter((e) => e.includes('404'));
    const mixedContent = errors.filter((e) => e.includes('Mixed Content'));

    console.log('=== MEMORY GRAPH ERRORS ===');
    for (const err of errors) {
      console.log(`  ${err}`);
    }

    expect(mixedContent, 'No Mixed Content errors').toHaveLength(0);
    expect(notFound, 'No 404 errors').toHaveLength(0);
  });

  test('intelligence search page has no 404 errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('requestfailed', (req) => {
      errors.push(`REQUEST FAILED: ${req.url()} — ${req.failure()?.errorText}`);
    });

    await page.goto(`${SITE}/dashboard/intelligence/search`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    const notFound = errors.filter((e) => e.includes('404'));
    const mixedContent = errors.filter((e) => e.includes('Mixed Content'));

    console.log('=== INTELLIGENCE SEARCH ERRORS ===');
    for (const err of errors) {
      console.log(`  ${err}`);
    }

    expect(mixedContent, 'No Mixed Content errors').toHaveLength(0);
    expect(notFound, 'No 404 errors').toHaveLength(0);
  });

  test('crawler knowledge-graph page has no 404 errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('requestfailed', (req) => {
      errors.push(`REQUEST FAILED: ${req.url()} — ${req.failure()?.errorText}`);
    });

    await page.goto(`${SITE}/dashboard/crawler/knowledge-graph`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    const notFound = errors.filter((e) => e.includes('404'));
    const mixedContent = errors.filter((e) => e.includes('Mixed Content'));

    console.log('=== CRAWLER KNOWLEDGE GRAPH ERRORS ===');
    for (const err of errors) {
      console.log(`  ${err}`);
    }

    expect(mixedContent, 'No Mixed Content errors').toHaveLength(0);
    expect(notFound, 'No 404 errors').toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Route reachability — all pages load without server crash
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Deployed Route Health', () => {
  const routes = [
    '/dashboard/home',
    '/dashboard/crawler/home',
    '/dashboard/crawler/crawl',
    '/dashboard/crawler/knowledge-graph',
    '/dashboard/memory/home',
    '/dashboard/memory/memories',
    '/dashboard/memory/graph',
    '/dashboard/memory/analytics',
    '/dashboard/memory/matters',
    '/dashboard/intelligence/search',
    '/dashboard/intelligence/chat',
    '/dashboard/intelligence/knowledge-graph',
    '/dashboard/intelligence/investigations',
  ];

  for (const path of routes) {
    test(`${path} responds without 500`, async ({ page }) => {
      const response = await page.goto(`${SITE}${path}`);
      const status = response?.status();
      expect(status, `${path} should not return 500`).not.toBe(500);
    });
  }
});
