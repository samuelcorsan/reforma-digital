import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';

/** VISUAL_QA=1 (visual-qa workflow): 1280 and 390 px screenshots of where each test ends. */
const visualQa = process.env.VISUAL_QA === '1';

/** Chromium with the test build (dist-test) loaded; shared by every e2e spec. */
export const test = base.extend<{ extension: BrowserContext }>({
  extension: async ({}, use, testInfo) => {
    const profile = await mkdtemp(path.join(os.tmpdir(), 'reforma-digital-test-'));
    const extension = path.resolve('dist-test');
    const context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      headless: true,
      ...(process.env.BG_CHROMIUM_PATH ? { executablePath: process.env.BG_CHROMIUM_PATH } : {}),
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    try {
      await use(context);
      const page = context
        .pages()
        .reverse()
        .find((p) => p.url().startsWith('http'));
      if (visualQa && page) {
        await page.screenshot({ path: testInfo.outputPath('1280.png') });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: testInfo.outputPath('390.png') });
      }
    } finally {
      await context.close();
      await rm(profile, { recursive: true, force: true });
    }
  },
});
