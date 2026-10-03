import { defineConfig } from '@playwright/test';

/** Visual QA of apps/web for the visual-qa workflow: screenshots and a scroll video per page and width. */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'web.qa.ts',
  outputDir: 'test-results/web',
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:3100', video: 'on' },
  projects: [
    { name: '1280', use: { viewport: { width: 1280, height: 720 } } },
    { name: '390', use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command:
      'pnpm --filter @reforma-digital/web build && pnpm --filter @reforma-digital/web start --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
