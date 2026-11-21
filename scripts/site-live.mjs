/**
 * Assisted check against the REAL official site (not an appointment bot).
 *
 *   npm run build && npm run site:live -- <site>
 *
 * 1. Without the extension: flow.original() → "original-*" screenshots and fixtures.
 * 2. With the extension: flow.enhanced() → checks and "mejorada-*" screenshots.
 * 3. Disabling the site from storage restores the original page.
 *
 * Opens a visible window: headless Chromium gets the official anti-bot check, which is never bypassed.
 */
import { flowContext, launch, requireBuild, sitesWithFlow } from './lib/live.mjs';

requireBuild();
const results = [];
for (const site of await sitesWithFlow()) {
  {
    const { context, page } = await launch(`${site.id}-original`);
    await site.flow.original(
      flowContext(site, page, { prefix: 'original', fixtures: true, results }),
    );
    await context.close();
  }
  {
    const { context, page } = await launch(`${site.id}-enhanced`, { extension: true });
    const ctx = flowContext(site, page, { prefix: 'mejorada', fixtures: false, results });
    await site.flow.enhanced(ctx);
    // Per-site switch, as the popup does it (chrome.storage.local.disabledSites).
    const worker = context.serviceWorkers().at(0);
    const extensionPage = await context.newPage();
    const extensionId = worker
      ? new URL(worker.url()).host
      : await extensionPage
          .goto('chrome://extensions')
          .then(() =>
            extensionPage.evaluate(
              () =>
                document
                  .querySelector('extensions-manager')
                  ?.shadowRoot?.querySelector('extensions-item-list')
                  ?.shadowRoot?.querySelector('extensions-item')?.id,
            ),
          );
    await extensionPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await extensionPage.evaluate(
      (id) => chrome.storage.local.set({ disabledSites: [id] }),
      site.id,
    );
    await page.waitForTimeout(500);
    ctx.check(
      'Disabling the site restores the original page',
      (await page.locator('[data-bg-host]').count()) === 0 &&
        (await page.getAttribute('html', 'data-bg-site')) === null,
    );
    await context.close();
  }
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
