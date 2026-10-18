import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { readSites } from './sites.mjs';
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
assert.equal(manifest.manifest_version, 3);
// Allow-list: any other key (optional permissions, host permissions, background, sandbox,
// externally_connectable, web_accessible_resources...) must be reviewed before it ships.
assert.deepEqual(Object.keys(manifest).sort(), [
  'action',
  'content_scripts',
  'content_security_policy',
  'description',
  'manifest_version',
  'minimum_chrome_version',
  'name',
  'permissions',
  'version',
]);
assert.deepEqual(manifest.permissions, ['storage']);
assert.deepEqual(manifest.content_security_policy, {
  extension_pages:
    "default-src 'none'; script-src 'self'; style-src 'self'; object-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'",
});
const sites = await readSites();
// One isolated content script per enabled site, injected only on that site's exact routes.
assert.deepEqual(
  manifest.content_scripts.map((entry) => entry.js),
  sites.map((site) => [`content/${site.id}.js`]),
);
for (const [index, site] of sites.entries()) {
  const entry = manifest.content_scripts[index];
  assert.equal(entry.world, 'ISOLATED');
  assert.equal(entry.all_frames, false);
  assert.deepEqual(entry.matches, site.matches);
}
assert.ok(!JSON.stringify(manifest).includes('127.0.0.1'));
// Bare names, not calls: `fetch?.(u)`, `f = fetch` or `document['cookie']` must also fail.
// Source-level aliases (globalThis[...], window.open) are covered by the lint rules.
const forbidden = [
  /\beval\b/,
  /\bFunction\s*\(/,
  /\bfetch\b/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /\bRTCPeerConnection\b/,
  /\bImage\b/,
  /\bsendBeacon\b/,
  // Portal styles target cookie banners (#cookie-law-info-bar); a bare `cookie` is the API.
  /\bcookie\b(?!-)/,
  /\bcookieStore\b/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bindexedDB\b/,
  /\bcaches\b/,
];
for (const file of await readdir('dist', { recursive: true })) {
  if (!/\.(js|html|css)$/.test(file)) continue;
  const code = await readFile(path.join('dist', file), 'utf8');
  for (const pattern of forbidden)
    assert.ok(!pattern.test(code), `${file}: forbidden runtime capability ${pattern}`);
  assert.ok(!/<script[^>]+src=["']https?:/i.test(code));
}
console.log(
  'Bundle audit passed: packaged scripts, exact site matches, no detected networking or page storage APIs. This static check is not a security audit.',
);
