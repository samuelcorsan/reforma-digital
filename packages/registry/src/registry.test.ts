import { expect, it, vi } from 'vitest';
import { createSiteAdapter, matchesSite, routePatterns, validateSiteConfig } from './index';

const config = {
  id: 'example',
  name: 'Example',
  enabled: true,
  origins: ['https://example.test'],
  pathPrefix: '/form/',
  homepage: 'https://example.test/form/',
  status: 'experimental',
};
it('keeps a disabled subproject inactive even when its route matches', () => {
  const prepare = vi.fn(() => null);
  const adapter = createSiteAdapter({ ...config, enabled: false }, [
    { id: 'page', matches: () => true, prepare },
  ]);
  expect(adapter.prepare(document, new URL(config.homepage), () => {})).toBeNull();
  expect(prepare).not.toHaveBeenCalled();
});
it('rejects ambiguous page registrations and foreign origins', () => {
  const prepare = vi.fn(() => null);
  const page = { id: 'page', matches: () => true, prepare };
  const adapter = createSiteAdapter(config, [page, { ...page, id: 'other' }]);
  adapter.prepare(document, new URL(config.homepage), () => {});
  adapter.prepare(document, new URL('https://evil.test/form/'), () => {});
  expect(prepare).not.toHaveBeenCalled();
});
it('dispatches to the one matching page', () => {
  const prepare = vi.fn(() => null);
  const adapter = createSiteAdapter(config, [{ id: 'page', matches: () => true, prepare }]);
  adapter.prepare(document, new URL(config.homepage), () => {});
  expect(prepare).toHaveBeenCalledOnce();
});
it('matches multi-path routes and exact paths only on their own origin', () => {
  const adapter = createSiteAdapter(
    {
      id: config.id,
      name: config.name,
      enabled: config.enabled,
      homepage: config.homepage,
      status: config.status,
      routes: [
        { origin: 'https://info.example.test', path: '/servicio' },
        { origin: 'https://app.example.test', pathPrefix: '/app/' },
      ],
    },
    [],
  );
  expect(matchesSite(adapter, new URL('https://info.example.test/servicio'))).toBe(true);
  expect(matchesSite(adapter, new URL('https://info.example.test/servicio/otra'))).toBe(false);
  expect(matchesSite(adapter, new URL('https://app.example.test/app/paso'))).toBe(true);
  expect(matchesSite(adapter, new URL('https://app.example.test/servicio'))).toBe(false);
  expect(routePatterns(adapter.routes)).toEqual([
    'https://info.example.test/servicio',
    'https://info.example.test/servicio?*',
    'https://app.example.test/app/*',
  ]);
});
it('expects() is true only when exactly one page claims the URL', () => {
  const page = {
    id: 'page',
    matches: (url: URL) => url.pathname === '/form/a',
    prepare: () => null,
  };
  const adapter = createSiteAdapter(config, [page]);
  expect(adapter.expects(new URL('https://example.test/form/a'))).toBe(true);
  expect(adapter.expects(new URL('https://example.test/form/b'))).toBe(false);
  expect(adapter.expects(new URL('https://evil.test/form/a'))).toBe(false);
});
it('validates site.config.json', () => {
  expect(validateSiteConfig(config, 'example')).toEqual([]);
  expect(validateSiteConfig(config, 'other').join()).toMatch(/folder/);
  expect(validateSiteConfig({ ...config, pathPrefix: '/' }).join()).toMatch(/whole origin/);
  expect(validateSiteConfig({ ...config, pathPrefix: '/form' }).join()).toMatch(/ending in "\/"/);
  expect(validateSiteConfig({ ...config, origins: ['http://example.test'] }).join()).toMatch(
    /HTTPS/,
  );
  expect(validateSiteConfig({ ...config, origins: ['https://*.example.test'] }).join()).toMatch(
    /HTTPS/,
  );
  expect(validateSiteConfig({ ...config, routes: [] }).join()).toMatch(/either routes/);
  expect(validateSiteConfig({ ...config, verifiedAt: '27/09/2026' }).join()).toMatch(/verifiedAt/);
  for (const homepage of ['http://example.test/form/', 'https://example.test/other', 'nope'])
    expect(validateSiteConfig({ ...config, homepage }).join()).toMatch(/homepage/);
  // Disabled placeholders may keep an empty configuration.
  expect(validateSiteConfig({ ...config, enabled: false, origins: [], pathPrefix: '/' })).toEqual(
    [],
  );
});
