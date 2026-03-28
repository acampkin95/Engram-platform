import { expect, test } from '@playwright/test';

/**
 * Engram Platform — Smoke Tests
 *
 * These tests verify that every critical route loads without server errors,
 * key UI elements render correctly, and basic interactions work.
 *
 * The tests are resilient to backend services being unavailable:
 * pages may display either their normal content *or* an error state,
 * and both are acceptable as long as the frontend itself doesn't crash.
 */

const SETTLE_TIMEOUT = 15_000;

// ─────────────────────────────────────────────────────────────────────────────
// Route health — every critical path returns a non-500 response
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Route Health', () => {
  const routes = [
    { path: '/', label: 'root redirect' },
    { path: '/dashboard/home', label: 'dashboard home' },
    { path: '/dashboard/crawler/home', label: 'crawler home' },
    { path: '/dashboard/crawler/crawl', label: 'crawler crawl' },
    { path: '/dashboard/memory/home', label: 'memory home' },
    { path: '/dashboard/memory/memories', label: 'memory memories' },
    { path: '/dashboard/memory/graph', label: 'memory graph' },
    { path: '/dashboard/memory/analytics', label: 'memory analytics' },
    { path: '/dashboard/intelligence/search', label: 'intelligence search' },
    { path: '/dashboard/intelligence/chat', label: 'intelligence chat' },
  ];

  for (const { path, label } of routes) {
    test(`${label} (${path}) responds without 500`, async ({ page }) => {
      const response = await page.goto(path);
      const status = response?.status();
      expect(status, `${path} should not return 500`).not.toBe(500);
    });
  }

  test('root (/) redirects away from itself', async ({ page }) => {
    await page.goto('/');
    expect(page.url()).not.toBe('http://localhost:3002/');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar & navigation — always rendered regardless of backend state
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Sidebar Navigation', () => {
  test('renders all three nav groups', async ({ page }) => {
    await page.goto('/dashboard/home');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('CRAWLER', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('MEMORY', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('INTELLIGENCE', { exact: true }).first()).toBeVisible();
  });

  test('nav link navigates to crawler overview', async ({ page }) => {
    await page.goto('/dashboard/home');
    await page.waitForLoadState('domcontentloaded');

    const overviewLink = page.getByRole('link', { name: /Overview/i }).first();
    await overviewLink.click();
    await expect(page).toHaveURL(/\/dashboard\/crawler\/home/);
  });

  test('nav link navigates to RAG Chat', async ({ page }) => {
    await page.goto('/dashboard/home');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('link', { name: /RAG Chat/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/intelligence\/chat/);
  });

  test('sidebar collapse toggle works', async ({ page }) => {
    await page.goto('/dashboard/home');
    await page.waitForLoadState('domcontentloaded');

    // The ENGRAM text should be visible when sidebar is expanded
    await expect(page.getByText('ENGRAM', { exact: true })).toBeVisible();

    // Click collapse button
    const collapseBtn = page.getByRole('button', { name: /Collapse sidebar/i });
    await collapseBtn.click();

    // After collapse, ENGRAM text should be hidden
    await expect(page.getByText('ENGRAM', { exact: true })).toBeHidden();

    // Expand again
    const expandBtn = page.getByRole('button', { name: /Expand sidebar/i });
    await expandBtn.click();
    await expect(page.getByText('ENGRAM', { exact: true })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Header bar — always shows page title based on pathname
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Header Bar', () => {
  const pageTitles = [
    { path: '/dashboard/home', title: 'Dashboard' },
    { path: '/dashboard/crawler/home', title: 'Crawler Overview' },
    { path: '/dashboard/memory/home', title: 'Memory Overview' },
    { path: '/dashboard/intelligence/search', title: 'Unified Search' },
    { path: '/dashboard/intelligence/chat', title: 'RAG Chat' },
  ];

  for (const { path, title } of pageTitles) {
    test(`shows "${title}" for ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');

      // Header h2 is always rendered by DashboardClient
      await expect(page.locator('header').getByText(title, { exact: true })).toBeVisible({
        timeout: SETTLE_TIMEOUT,
      });
    });
  }

  test('shows service status indicators', async ({ page }) => {
    await page.goto('/dashboard/home');
    await page.waitForLoadState('domcontentloaded');

    // Header always shows CRAWLER and MEMORY status labels
    const header = page.locator('header');
    await expect(header.getByText('CRAWLER')).toBeVisible();
    await expect(header.getByText('MEMORY')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Home — main overview with grid widgets
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Dashboard Home', () => {
  test('renders without crash and settles to some state', async ({ page }) => {
    await page.goto('/dashboard/home');

    // The header bar is always rendered regardless of data state
    await expect(page.locator('header').getByText('Dashboard', { exact: true })).toBeVisible();

    // Page settles to content, error, or skeleton — all acceptable.
    // Just verify main has some DOM content (page didn't white-screen).
    const main = page.getByRole('main');
    await expect(main.locator('div').first()).toBeAttached({ timeout: SETTLE_TIMEOUT });
  });

  test('quick access links are present when data loads', async ({ page }) => {
    await page.goto('/dashboard/home');

    // Wait for possible content load (short timeout — if backend is down, skip gracefully)
    const main = page.getByRole('main');
    const overview = main.getByRole('heading', { name: /Platform Overview/i });
    const loaded = await overview.isVisible({ timeout: 10_000 }).catch(() => false);

    if (loaded) {
      await expect(page.getByText('Start Crawl')).toBeVisible();
      await expect(page.getByText('Browse Memories')).toBeVisible();
      await expect(page.getByText('Unified Search')).toBeVisible();
    }
  });

  test('refresh button triggers data reload without crash', async ({ page }) => {
    await page.goto('/dashboard/home');

    const main = page.getByRole('main');
    const overview = main.getByRole('heading', { name: /Platform Overview/i });
    const loaded = await overview.isVisible({ timeout: 10_000 }).catch(() => false);

    if (loaded) {
      const refreshBtn = page.getByRole('button', { name: /Refresh/i });
      await refreshBtn.click();
      // Still shows heading after refresh
      await expect(overview).toBeVisible({ timeout: SETTLE_TIMEOUT });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Crawler Home — stats, recent jobs, New Crawl button
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Crawler Home', () => {
  test('renders section header or error/loading state', async ({ page }) => {
    await page.goto('/dashboard/crawler/home');

    // Section header (success) vs loading/error states
    const sectionTitle = page.getByRole('heading', { name: /^Crawler$/i });
    const loadingOrError = page.getByText(/Loading crawler|Failed to load/i);
    await expect(sectionTitle.or(loadingOrError)).toBeVisible({ timeout: SETTLE_TIMEOUT });
  });

  test('New Crawl button navigates to crawl page', async ({ page }) => {
    await page.goto('/dashboard/crawler/home');

    const sectionTitle = page.getByRole('heading', { name: /^Crawler$/i });
    const loadingOrError = page.getByText(/Loading crawler|Failed to load/i);
    await expect(sectionTitle.or(loadingOrError)).toBeVisible({ timeout: SETTLE_TIMEOUT });

    if (await sectionTitle.isVisible()) {
      const newCrawlBtn = page.getByRole('button', { name: /New Crawl/i });
      await expect(newCrawlBtn).toBeVisible();
      await newCrawlBtn.click();
      await expect(page).toHaveURL(/\/dashboard\/crawler\/crawl/);
    }
  });

  test('stats cards render when data is available', async ({ page }) => {
    await page.goto('/dashboard/crawler/home');

    const sectionTitle = page.getByRole('heading', { name: /^Crawler$/i });
    const loadingOrError = page.getByText(/Loading crawler|Failed to load/i);
    await expect(sectionTitle.or(loadingOrError)).toBeVisible({ timeout: SETTLE_TIMEOUT });

    if (await sectionTitle.isVisible()) {
      await expect(page.getByText('Total Jobs')).toBeVisible();
      await expect(page.getByText('Completed')).toBeVisible();
      await expect(page.getByText('Running')).toBeVisible();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Intelligence Search — always renders search UI regardless of backend
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Intelligence Search', () => {
  test('renders section header and search input', async ({ page }) => {
    await page.goto('/dashboard/intelligence/search');

    // Scope to main to avoid matching the header bar h2
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: /Unified Search/i })).toBeVisible({
      timeout: SETTLE_TIMEOUT,
    });

    await expect(page.getByPlaceholder(/Search across Crawler and Memory/i)).toBeVisible();
  });

  test('shows pre-search empty state', async ({ page }) => {
    await page.goto('/dashboard/intelligence/search');

    await expect(page.getByText('Search across all systems')).toBeVisible({
      timeout: SETTLE_TIMEOUT,
    });
  });

  test('filter pills are interactive', async ({ page }) => {
    await page.goto('/dashboard/intelligence/search');
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: /Unified Search/i })).toBeVisible({
      timeout: SETTLE_TIMEOUT,
    });

    // Source filter pills (scope to main to avoid matching sidebar group buttons)
    const crawlerPill = main.getByRole('button', { name: 'Crawler', exact: true });
    const memoryPill = main.getByRole('button', { name: 'Memory', exact: true });
    const allPill = main.getByRole('button', { name: 'All', exact: true });

    await expect(crawlerPill).toBeVisible();
    await expect(memoryPill).toBeVisible();

    // Click Crawler filter
    await crawlerPill.click();
    // Click All to reset
    await allPill.click();
  });

  test('search input accepts text and triggers on Enter', async ({ page }) => {
    await page.goto('/dashboard/intelligence/search');

    const searchInput = page.getByPlaceholder(/Search across Crawler and Memory/i);
    await expect(searchInput).toBeVisible({ timeout: SETTLE_TIMEOUT });

    await searchInput.fill('test query');
    await expect(searchInput).toHaveValue('test query');

    // Press Enter to search
    await searchInput.press('Enter');

    // After search, the two-column results layout should appear
    // (either with results, empty state, or error state — but NOT the pre-search state)
    await expect(page.getByText('Search across all systems')).toBeHidden({
      timeout: SETTLE_TIMEOUT,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Intelligence Chat — dynamic import, always renders chat UI
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Intelligence Chat', () => {
  test('renders section header after dynamic import', async ({ page }) => {
    await page.goto('/dashboard/intelligence/chat');

    await expect(page.getByRole('heading', { name: /RAG Chat/i })).toBeVisible({
      timeout: SETTLE_TIMEOUT,
    });
  });

  test('shows empty conversation state', async ({ page }) => {
    await page.goto('/dashboard/intelligence/chat');

    await expect(page.getByText('Start a conversation')).toBeVisible({ timeout: SETTLE_TIMEOUT });
  });

  test('message input and send button render', async ({ page }) => {
    await page.goto('/dashboard/intelligence/chat');

    const chatInput = page.getByPlaceholder(/Ask anything/i);
    await expect(chatInput).toBeVisible({ timeout: SETTLE_TIMEOUT });

    const sendBtn = page.getByRole('button', { name: /Send/i });
    await expect(sendBtn).toBeVisible();
  });

  test('send button is disabled when input is empty', async ({ page }) => {
    await page.goto('/dashboard/intelligence/chat');

    const chatInput = page.getByPlaceholder(/Ask anything/i);
    await expect(chatInput).toBeVisible({ timeout: SETTLE_TIMEOUT });

    const sendBtn = page.getByRole('button', { name: /Send/i });
    await expect(sendBtn).toBeDisabled();

    // Type something — send should become enabled
    await chatInput.fill('hello');
    await expect(sendBtn).toBeEnabled();

    // Clear — send should be disabled again
    await chatInput.fill('');
    await expect(sendBtn).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Memory Home — overview with stats and recent memories
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Memory Home', () => {
  test('renders section header or loading/error state', async ({ page }) => {
    await page.goto('/dashboard/memory/home');

    const sectionTitle = page.getByRole('heading', { name: /^Memory$/i });
    const loadingOrError = page.getByText(/Loading memory|Failed to load/i);
    await expect(sectionTitle.or(loadingOrError)).toBeVisible({ timeout: SETTLE_TIMEOUT });
  });

  test('shows stats cards when data is available', async ({ page }) => {
    await page.goto('/dashboard/memory/home');

    const sectionTitle = page.getByRole('heading', { name: /^Memory$/i });
    const loadingOrError = page.getByText(/Loading memory|Failed to load/i);
    await expect(sectionTitle.or(loadingOrError)).toBeVisible({ timeout: SETTLE_TIMEOUT });

    if (await sectionTitle.isVisible()) {
      await expect(page.getByText('Total Memories')).toBeVisible();
      await expect(page.getByText('Total Entities')).toBeVisible();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Memory — Memories list page
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Memory Memories', () => {
  test('renders section header and Add Memory button', async ({ page }) => {
    await page.goto('/dashboard/memory/memories');

    // Scope to main to avoid matching the header bar h2
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: /^Memories$/i })).toBeVisible({
      timeout: SETTLE_TIMEOUT,
    });

    await expect(page.getByRole('button', { name: /Add Memory/i }).first()).toBeVisible();
  });

  test('shows data table, empty state, or error state', async ({ page }) => {
    await page.goto('/dashboard/memory/memories');

    // Scope to main to avoid strict mode violation
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: /^Memories$/i })).toBeVisible({
      timeout: SETTLE_TIMEOUT,
    });

    // One of: data table, empty state, or error state
    const table = main.locator('table');
    const emptyState = main.getByText(/No memories found/i);
    const errorState = main.getByText(/Failed to load/i);
    await expect(table.or(emptyState).or(errorState)).toBeVisible({ timeout: SETTLE_TIMEOUT });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Memory Graph — dynamic import page
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Memory Graph', () => {
  test('loads without crash', async ({ page }) => {
    const response = await page.goto('/dashboard/memory/graph');
    expect(response?.status()).not.toBe(500);

    // Header should show the page title
    await expect(page.locator('header').getByText('Memory Graph', { exact: true })).toBeVisible({
      timeout: SETTLE_TIMEOUT,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OSINT Canvas — intelligence workspace with entity graph, crawl stream, agents
// ─────────────────────────────────────────────────────────────────────────────

test.describe('OSINT Canvas', () => {
  test('route loads without 500', async ({ page }) => {
    const response = await page.goto('/dashboard/intelligence/canvas');
    expect(response?.status()).not.toBe(500);
  });

  test('renders OSINT CANVAS header after content loads', async ({ page }) => {
    await page.goto('/dashboard/intelligence/canvas');
    await page.waitForLoadState('domcontentloaded');
    const header = page.getByText('OSINT CANVAS', { exact: true });
    await expect(header).toBeVisible({ timeout: SETTLE_TIMEOUT });
  });

  test('shows stat badges after content loads', async ({ page }) => {
    await page.goto('/dashboard/intelligence/canvas');
    await page.waitForLoadState('domcontentloaded');
    const header = page.getByText('OSINT CANVAS', { exact: true });
    await expect(header).toBeVisible({ timeout: SETTLE_TIMEOUT });
    await expect(page.getByText('entities', { exact: false })).toBeVisible();
    await expect(page.getByText('stream', { exact: false })).toBeVisible();
  });

  test('investigate toggle button enters and exits investigation mode', async ({ page }) => {
    await page.goto('/dashboard/intelligence/canvas');
    await page.waitForLoadState('domcontentloaded');
    const header = page.getByText('OSINT CANVAS', { exact: true });
    await expect(header).toBeVisible({ timeout: SETTLE_TIMEOUT });

    const investigateBtn = page.getByRole('button', { name: /INVESTIGATE/i });
    await investigateBtn.click();

    const investigatingBtn = page.getByRole('button', { name: /INVESTIGATING/i });
    await expect(investigatingBtn).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /INVESTIGATE/i })).toBeVisible({ timeout: 5000 });
  });

  test('reset layout button is present in canvas', async ({ page }) => {
    await page.goto('/dashboard/intelligence/canvas');
    await page.waitForLoadState('domcontentloaded');
    const header = page.getByText('OSINT CANVAS', { exact: true });
    await expect(header).toBeVisible({ timeout: SETTLE_TIMEOUT });
    await expect(page.getByRole('button', { name: /Reset Layout/i })).toBeVisible();
  });

  test('canvas panels render with correct labels', async ({ page }) => {
    await page.goto('/dashboard/intelligence/canvas');
    await page.waitForLoadState('domcontentloaded');
    const header = page.getByText('OSINT CANVAS', { exact: true });
    await expect(header).toBeVisible({ timeout: SETTLE_TIMEOUT });

    const entityGraph = page.getByText('ENTITY GRAPH');
    const crawlStream = page.getByText('CRAWL STREAM');
    await expect(entityGraph.or(crawlStream).first()).toBeVisible();
  });

  test('stream panel shows live/paused indicator', async ({ page }) => {
    await page.goto('/dashboard/intelligence/canvas');
    await page.waitForLoadState('domcontentloaded');
    const header = page.getByText('OSINT CANVAS', { exact: true });
    await expect(header).toBeVisible({ timeout: SETTLE_TIMEOUT });

    const liveOrPaused = page.getByText(/LIVE|PAUSED/, { exact: false });
    await expect(liveOrPaused.first()).toBeVisible();
  });

  test('intelligence layer toggle buttons are present', async ({ page }) => {
    await page.goto('/dashboard/intelligence/canvas');
    await page.waitForLoadState('domcontentloaded');
    const header = page.getByText('OSINT CANVAS', { exact: true });
    await expect(header).toBeVisible({ timeout: SETTLE_TIMEOUT });

    const processedLayer = page.getByRole('button', { name: /PROCESSED/i });
    await expect(processedLayer).toBeVisible();
  });
});
