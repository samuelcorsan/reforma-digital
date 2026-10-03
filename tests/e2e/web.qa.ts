import { test } from '@playwright/test';

/** Public apps/web pages that render without a database or API keys. Run with playwright.qa.config.ts. */
const pages = ['/', '/demo', '/explorar', '/how-it-works', '/privacy', '/sources'];

for (const path of pages) {
  test(path.slice(1) || 'home', async ({ page }, testInfo) => {
    await page.goto(path);
    // Scroll to the end so the video shows entry animations and the screenshot includes them.
    for (let y = 0; y < (await page.evaluate(() => document.body.scrollHeight)); y += 300) {
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(400);
    }
    await page.screenshot({
      path: testInfo.outputPath(`${testInfo.project.name}.png`),
      fullPage: true,
    });
  });
}
