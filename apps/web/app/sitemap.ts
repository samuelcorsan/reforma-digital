import type { MetadataRoute } from 'next';
import { siteUrl } from '../lib/site';
import { congressBase, congressSections } from '../lib/congreso/routes';
import { electionOrder, electionsHref } from '../lib/elecciones/pages';

// Solo páginas indexables.
const pages = [
  '/',
  '/equipo',
  '/privacy',
  '/api',
  '/escritorio',
  ...congressSections.flatMap(({ pages }) =>
    pages.map(([, path]) => `${congressBase}${path ? `/${path}` : ''}`),
  ),
  electionsHref(),
  ...electionOrder.map((id) => electionsHref(id)),
];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((path) => ({ url: new URL(path, siteUrl).href }));
}
