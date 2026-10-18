// Shared helpers for the real-site tools (site:live, site:record, site:preview).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { readSites } from '../sites.mjs';

export const cache = path.resolve('.cache');

/** Enabled sites with a flow.ts, optionally filtered by the first CLI argument. */
export async function sitesWithFlow(argv = process.argv.slice(2)) {
  const wanted = argv.find((arg) => !arg.startsWith('-'));
  const sites = (await readSites()).filter((site) => !wanted || site.id === wanted);
  if (wanted && !sites.length) throw new Error(`Unknown or disabled site: ${wanted}`);
  const out = [];
  for (const site of sites) {
    const file = path.resolve('sites', site.id, 'flow.ts');
    if (!existsSync(file)) console.warn(`· ${site.id}: no flow.ts, skipped`);
    else
      out.push({
        ...site,
        dir: path.resolve('sites', site.id),
        flow: (await import(file)).default,
      });
  }
  return out;
}

export function requireBuild(dir = 'dist') {
  if (!existsSync(path.join(dir, 'manifest.json'))) {
    console.error(`Missing ${dir}/: run npm run build first.`);
    process.exit(1);
  }
}

/**
 * Visible Chromium. In headless mode official sites show their anti-bot check, and these tools
 * never try to get around it.
 */
export async function launch(profile, { extension = false, headless = false, har } = {}) {
  const dir = path.resolve('.cache/profiles', profile);
  rmSync(dir, { recursive: true, force: true });
  const dist = path.resolve('dist');
  const context = await chromium.launchPersistentContext(dir, {
    channel: 'chromium',
    headless,
    viewport: { width: 1280, height: 900 },
    locale: 'es-ES',
    args: extension ? [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`] : [],
    ...(har ? { recordHar: { path: har, content: 'embed', mode: 'full' } } : {}),
  });
  return { context, page: context.pages()[0] ?? (await context.newPage()) };
}

export function harPath(siteId) {
  mkdirSync(cache, { recursive: true });
  return path.join(cache, `${siteId}.har`);
}

/** Serves pages from one or more HARs recorded by site:record: no request reaches the official site. */
export async function replayHar(context, files) {
  const key = (u) => {
    const url = new URL(u);
    return url.origin + url.pathname.replace(/;jsessionid=[^/?#]*/i, '') + url.search;
  };
  // A page and its own XHR can share a URL (GET document vs POST data), so match the method first
  // and fall back to any recording of that URL (e.g. a page reached by a form POST, opened by GET).
  // Two searches POST to the same URL: the request body tells them apart.
  const byBody = new Map();
  const byMethod = new Map();
  const byUrl = new Map();
  const entries = [files]
    .flat()
    .flatMap((file) => JSON.parse(readFileSync(file, 'utf8')).log.entries);
  for (const entry of entries) {
    if (entry.response.status >= 300 || entry.response.content?.text === undefined) continue;
    const body = entry.request.postData?.text;
    if (body)
      byBody.set(`${entry.request.method} ${key(entry.request.url)} ${body}`, entry.response);
    byMethod.set(`${entry.request.method} ${key(entry.request.url)}`, entry.response);
    if (!byUrl.has(key(entry.request.url)) || entry.request.method === 'GET')
      byUrl.set(key(entry.request.url), entry.response);
  }
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (/\/TSPD\/|google|ruxitagent|\/rb_/.test(url)) return route.abort();
    const method = route.request().method();
    const res =
      byBody.get(`${method} ${key(url)} ${route.request().postData() ?? ''}`) ??
      byMethod.get(`${method} ${key(url)}`) ??
      byUrl.get(key(url));
    if (!res) return route.abort();
    const body =
      res.content.encoding === 'base64'
        ? Buffer.from(res.content.text, 'base64')
        : res.content.text;
    // Text bodies come back from the HAR as JS strings: re-encode them as UTF-8 and say so,
    // whatever charset the official server declared (e.g. ISO-8859-15 on www2.agenciatributaria).
    const textBody = res.content.encoding !== 'base64';
    const headers = Object.fromEntries(
      res.headers
        .filter(
          (h) => !/content-(encoding|length|security)|transfer-encoding|set-cookie/i.test(h.name),
        )
        .map((h) => [
          h.name,
          textBody && /^content-type$/i.test(h.name)
            ? h.value.replace(/charset=[^;]+/i, 'charset=utf-8')
            : h.value,
        ]),
    );
    await route.fulfill({ status: res.status, headers, body });
  });
}

/** FlowContext given to original()/enhanced(). */
export function flowContext(site, page, { prefix, fixtures, results }) {
  const shots = path.join(site.dir, 'docs', 'screenshots');
  const check = (name, ok, detail = '') => {
    results.push({ site: site.id, name, ok, detail });
    console.log(`${ok ? '✔' : '✘'} [${site.id}] ${name}${detail ? ` — ${detail}` : ''}`);
  };
  return {
    page,
    check,
    async waitOfficial(selector) {
      try {
        await page.waitForSelector(selector, { state: 'attached', timeout: 30_000 });
      } catch (error) {
        const text = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
        console.error(
          `Missing ${selector} on ${page.url()}\n--- visible text ---\n${text.slice(0, 800)}`,
        );
        throw error;
      }
      await page.waitForLoadState('load');
    },
    async waitInterface() {
      await page.locator('[data-bg-host]').first().waitFor({ state: 'attached', timeout: 20_000 });
    },
    async capture(name, target) {
      if (!prefix) return;
      mkdirSync(shots, { recursive: true });
      if (site.flow.captureCss)
        await page.addStyleTag({ content: site.flow.captureCss }).catch(() => {});
      // Page captures always start at the top, so every step is comparable.
      if (!target) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);
      }
      await (target ?? page).screenshot({
        path: path.join(shots, `${target ? 'panel' : prefix}-${name}.png`),
        // Playwright's default caret hiding writes a style attribute on every input; the runtime
        // treats that as a changed official control and restores the original page.
        caret: 'initial',
      });
    },
    async fixture(name) {
      if (!fixtures) return;
      const html = await page.evaluate(fixtureHtml);
      writeFileSync(
        path.join(site.dir, 'fixtures', `${name}.html`),
        html.replace(/;jsessionid=[^"'?#\s]*/gi, ''),
      );
    },
  };
}

/**
 * The page as a fixture: no scripts, embedded content, comments, session tokens or filled-in
 * text. Inline handlers (onclick, javascript: URLs) stay: adapters read them and fixtures are
 * only served on 127.0.0.1. Runs inside the page, so it uses no closures; `doc` lets the same
 * rules re-clean saved fixtures.
 */
export function fixtureHtml(doc = document) {
  const root = doc.documentElement.cloneNode(true);
  // <template> content is a separate fragment that querySelectorAll and TreeWalker skip.
  const roots = [root];
  for (const r of roots) {
    r.querySelectorAll('template').forEach((t) => roots.push(t.content));
    r.querySelectorAll(
      'script, noscript, iframe, frame, object, embed, [data-bg-host], [data-bg-notice]',
    ).forEach((n) => n.remove());
    // Comments keep disabled widgets with their session ids (e.g. a commented-out chat bot).
    const walker = doc.createTreeWalker(r, 128 /* NodeFilter.SHOW_COMMENT */);
    const comments = [];
    while (walker.nextNode()) comments.push(walker.currentNode);
    comments.forEach((n) => n.remove());
    // Hidden inputs carry anti-CSRF tokens: values are emptied and per-page UUID names fixed.
    r.querySelectorAll('input[type="hidden"]').forEach((n) => {
      n.setAttribute('value', '');
      if (/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(n.getAttribute('name') ?? ''))
        n.setAttribute('name', '00000000-0000-0000-0000-000000000000');
    });
    // Text the server echoed into editable fields (e.g. the walk's search). Read-only fields keep
    // theirs: adapters read them (e.g. the chosen province).
    r.querySelectorAll('input, textarea').forEach((n) => {
      if (n.readOnly || n.disabled) return;
      if (n.localName === 'textarea') n.textContent = '';
      else if (
        n.hasAttribute('value') &&
        !['hidden', 'checkbox', 'radio', 'submit', 'button', 'reset', 'image'].includes(n.type)
      )
        n.setAttribute('value', '');
    });
    // Tokens in <meta name="csrf-token">-style tags.
    r.querySelectorAll('meta[name][content]').forEach((n) => {
      if (/csrf|xsrf|token|session/i.test(n.getAttribute('name'))) n.setAttribute('content', '');
    });
    for (const n of r.querySelectorAll('*'))
      for (const { name, value } of Array.from(n.attributes)) {
        // Token-bearing attributes (data-csrf-token, data-session-id, CSP nonce) are emptied.
        if (/csrf|xsrf|token|session|^nonce$/i.test(name)) {
          n.setAttribute(name, '');
          continue;
        }
        // Session-bound URL parameters, in links, form actions and inline navigations alike.
        const clean = value.replace(
          /([?&;#](?:jsessionid|token|state|nonce|code|code_challenge|p_auth|_csrf|csrf|sid|session|ticket|samlrequest|samlresponse|relaystate|access_token|id_token)=)[^?&#;'"\s]*/gi,
          '$1',
        );
        if (clean !== value) n.setAttribute(name, clean);
      }
  }
  return '<!DOCTYPE html>\n' + root.outerHTML;
}
