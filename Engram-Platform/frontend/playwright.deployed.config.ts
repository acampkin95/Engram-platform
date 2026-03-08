import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'deployed-smoke.spec.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: 'https://memory.velocitydigi.com',
    trace: 'off',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: undefined },
    },
  ],
  // No webServer — testing against already-deployed site
});
