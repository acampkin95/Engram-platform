/**
 * T28 — Smoke Tests: All 16 Pages
 *
 * Verifies each route renders without crashing:
 *  - The layout (nav) is present
 *  - The #main-content area is visible
 *  - No uncaught JavaScript exceptions
 *
 * Tests do NOT depend on the backend API being available.
 * They assert on the frontend-only rendered state (empty states, loaders, etc.)
 */
import { test, expect } from '@playwright/test';

/** Exact routes from src/App.tsx */
const PAGES = [
  { route: '/', label: 'Dashboard' },
  { route: '/osint', label: 'OSINT Dashboard' },
  { route: '/data', label: 'Data Management' },
  { route: '/storage', label: 'Storage' },
  { route: '/graph', label: 'Knowledge Graph' },
  { route: '/investigations', label: 'Investigation List' },
  { route: '/investigations/test-smoke-123', label: 'Investigation Detail' },
  { route: '/settings', label: 'Settings' },
  { route: '/crawl/new', label: 'New Crawl (CrawlConfigPage)' },
  { route: '/crawl/history', label: 'Crawl History' },
  { route: '/crawl/active', label: 'Active Crawls' },
  { route: '/crawl/test-smoke-123/monitor', label: 'Crawl Monitor' },
  { route: '/crawl/test-smoke-123/results', label: 'Result Viewer' },
  { route: '/scheduler', label: 'Scheduler' },
  { route: '/extraction-builder', label: 'Extraction Builder' },
  { route: '/rag', label: 'RAG Pipeline' },
] as const;

test.describe('Page Smoke Tests — All 16 Pages', () => {
  // Skip the onboarding wizard so it doesn't block page assertions
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('crawl4ai_onboarding_complete', 'true');
    });
  });

  for (const { route, label } of PAGES) {
    test(`${label} (${route}) — loads without crashing`, async ({ page }) => {
      const pageErrors: string[] = [];

      // Capture uncaught JS exceptions (real crashes, not API failures)
      page.on('pageerror', (err) => {
        pageErrors.push(err.message);
      });

      await page.goto(route);

      // The top-level navigation is part of the Layout component (not lazy-loaded),
      // so its presence proves the React tree rendered successfully.
      const nav = page.locator('nav[aria-label="Main navigation"]');
      await expect(nav).toBeVisible({ timeout: 15_000 });

      // The main content area must exist — even if page content is loading/empty.
      await expect(page.locator('#main-content')).toBeVisible();

      // No uncaught JS exceptions should have occurred.
      expect(
        pageErrors,
        `Unexpected JS errors on ${route}: ${pageErrors.join('; ')}`,
      ).toHaveLength(0);
    });
  }
});
