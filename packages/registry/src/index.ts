import type { ReactNode } from 'react';
import type { DomBridge } from '@reforma-digital/bridge';

/** Where an interface is mounted next to an official element (Element.insertAdjacentElement). */
export type PanelPosition = 'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend';

export interface Enhancement {
  /** In-place replacement. Source nodes never leave their original form or ancestry. */
  slots: { source: HTMLElement; render: () => ReactNode }[];
  /**
   * Additional interface blocks inserted next to official elements (guides, summaries, pickers).
   * Official content is never moved; the panel drives official controls through the bridge.
   */
  panels?: { anchor: Element; position: PanelPosition; render: () => ReactNode }[];
  /**
   * Where the community bar ("Interfaz comunitaria · sitio oficial" + "Ver original") goes.
   * Defaults to the top of <body>; sites whose official header is fixed/absolute place it in the flow.
   */
  shell?: { anchor: Element; position: PanelPosition };
  bridge: DomBridge;
  title: string;
  description: string;
  /** Screen id, exposed as data-bg-page on <html> so page styles can target one screen. */
  page?: string;
  /** Tailwind utilities applied to the original HTML only while this adapter is active. */
  pageClassName?: string;
  health: () => boolean;
}

/** One official origin plus either a path prefix (ending in "/") or an exact path. */
export type SiteRoute = { origin: string; pathPrefix: string } | { origin: string; path: string };

export interface SiteAdapter {
  enabled?: boolean;
  id: string;
  name: string;
  /** Every official origin and path handled by this site. */
  routes: readonly SiteRoute[];
  homepage: string;
  status: 'experimental' | 'verified';
  /** Must return null on an unknown page or an ambiguous DOM. */
  prepare: (document: Document, url: URL, restore: () => void) => Enhancement | null;
  /**
   * True when exactly one registered screen claims this URL. The runtime then waits for late
   * official content and, if the DOM never matches, shows a non-blocking "original page" notice.
   */
  expects: (url: URL) => boolean;
}

function routeMatches(route: SiteRoute, url: URL): boolean {
  if (route.origin !== url.origin) return false;
  return 'path' in route ? url.pathname === route.path : url.pathname.startsWith(route.pathPrefix);
}

export function matchesSite(adapter: Pick<SiteAdapter, 'enabled' | 'routes'>, url: URL): boolean {
  return (
    adapter.enabled !== false &&
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    adapter.routes.some((route) => routeMatches(route, url))
  );
}

/** Each route owns its UI and bindings; the extension knows only this contract. */
export interface SitePage {
  id: string;
  matches: (url: URL) => boolean;
  prepare: SiteAdapter['prepare'];
}

/** Contents of sites/<id>/site.config.json. */
export interface SiteConfig {
  id: string;
  name: string;
  enabled: boolean;
  /** Simple form: every origin shares one path prefix. */
  origins?: string[];
  pathPrefix?: string;
  /** Multi-path form, when origins use different paths. */
  routes?: SiteRoute[];
  homepage: string;
  status: string;
  /** Last date (YYYY-MM-DD) the bindings were checked against the real site. */
  verifiedAt?: string;
}

/** Normalizes both config forms to a list of routes. */
export function siteRoutes(
  config: Pick<SiteConfig, 'origins' | 'pathPrefix' | 'routes'>,
): SiteRoute[] {
  if (config.routes) return config.routes;
  return (config.origins ?? []).map((origin) => ({ origin, pathPrefix: config.pathPrefix ?? '/' }));
}

/**
 * Chrome match patterns for the manifest. A pattern's path also covers the query, so an exact
 * path is the path itself plus the path followed by "?". The runtime still checks exact routes.
 */
export function routePatterns(routes: readonly SiteRoute[]): string[] {
  return routes.flatMap((route) =>
    'path' in route
      ? [`${route.origin}${route.path}`, `${route.origin}${route.path}?*`]
      : [`${route.origin}${route.pathPrefix}*`],
  );
}

/**
 * Validates a site.config.json. Returns the list of problems (empty when valid).
 * Shared by the build scripts and the tests.
 */
export function validateSiteConfig(config: unknown, folder?: string): string[] {
  const errors: string[] = [];
  if (typeof config !== 'object' || config === null) return ['site.config.json must be an object'];
  const c = config as Partial<SiteConfig>;
  if (typeof c.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(c.id)) errors.push('Invalid site id');
  if (folder !== undefined && c.id !== folder)
    errors.push(`Site id must match its folder (${folder})`);
  if (typeof c.enabled !== 'boolean') errors.push('Sites must declare enabled: true or false');
  if (!['experimental', 'verified'].includes(c.status as string))
    errors.push('Invalid verification status');
  if (c.verifiedAt !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(c.verifiedAt))
    errors.push('verifiedAt must be YYYY-MM-DD');
  if (c.routes && (c.origins || c.pathPrefix))
    errors.push('Use either routes or origins + pathPrefix, not both');
  if (!c.enabled) return errors;

  const routes = siteRoutes(c);
  if (!routes.length) errors.push('Sites must declare exact HTTPS origins');
  for (const route of routes) {
    let origin: URL | null = null;
    try {
      origin = new URL(route.origin);
    } catch {
      /* reported below */
    }
    if (
      !origin ||
      origin.protocol !== 'https:' ||
      origin.origin !== route.origin ||
      route.origin.includes('*')
    )
      errors.push(`Sites must declare exact HTTPS origins (${route.origin})`);
    const value = 'path' in route ? route.path : route.pathPrefix;
    if (typeof value !== 'string' || !value.startsWith('/') || value.includes('*'))
      errors.push(`Invalid route path (${value})`);
    else if (!('path' in route) && !value.endsWith('/'))
      errors.push(
        `Sites must declare a path prefix ending in "/" (${value}); use "path" for an exact page`,
      );
    else if (!('path' in route) && value === '/')
      errors.push(
        `A route cannot cover a whole origin (${route.origin}); declare the service paths`,
      );
  }
  return errors;
}

export function createSiteAdapter(config: SiteConfig, pages: readonly SitePage[]): SiteAdapter {
  if (!['experimental', 'verified'].includes(config.status)) throw new Error('Invalid site status');
  const claim = (url: URL) => pages.filter((page) => page.matches(url));
  const adapter: SiteAdapter = {
    id: config.id,
    name: config.name,
    enabled: config.enabled,
    routes: siteRoutes(config),
    homepage: config.homepage,
    status: config.status === 'verified' ? 'verified' : 'experimental',
    prepare(document, url, restore) {
      if (!matchesSite(adapter, url)) return null;
      const matches = claim(url);
      return matches.length === 1 ? matches[0]!.prepare(document, url, restore) : null;
    },
    expects: (url) => matchesSite(adapter, url) && claim(url).length === 1,
  };
  return adapter;
}
