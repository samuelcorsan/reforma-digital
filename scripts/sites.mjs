import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { siteRoutes, routePatterns, validateSiteConfig } from '../packages/registry/src/index.ts';

/** Enabled sites, validated. Disabled sites are skipped (they are not built nor granted matches). */
export async function readSites() {
  const sites = [];
  const errors = [];
  for (const directory of await readdir('sites', { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    const config = JSON.parse(
      await readFile(path.join('sites', directory.name, 'site.config.json'), 'utf8'),
    );
    const problems = validateSiteConfig(config, directory.name);
    if (problems.length) errors.push(...problems.map((p) => `sites/${directory.name}: ${p}`));
    else if (config.enabled) {
      const routes = siteRoutes(config);
      sites.push({ ...config, routes, matches: routePatterns(routes) });
    }
  }
  if (errors.length) throw new Error(`Invalid site.config.json:\n  ${errors.join('\n  ')}`);
  return sites.sort((a, b) => a.id.localeCompare(b.id));
}

/** Local playground URLs (test builds only): each official path is served on 127.0.0.1:4173. */
export function testMatches(site) {
  return routePatterns(site.routes.map((route) => ({ ...route, origin: 'http://127.0.0.1:4173' })));
}

/** One virtual module per content script: the adapter of a single site. */
export function adapterPlugin(site) {
  return {
    name: 'site-adapters',
    resolveId(id) {
      if (id === 'virtual:site-adapters') return '\0site-adapters';
    },
    load(id) {
      if (id !== '\0site-adapters') return;
      return `import { adapter } from ${JSON.stringify(path.resolve('sites', site.id, 'src/adapter.ts'))};\nexport const adapters = [adapter];`;
    },
  };
}
