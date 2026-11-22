import type { MetadataRoute } from 'next';
import { siteUrl } from '../lib/site';
import { congressBase, congressSections } from '../lib/congreso/routes';
import { electionOrder, electionsHref } from '../lib/elecciones/pages';
import { serverIds } from '../lib/mcp/catalog';
import { fichaPath } from '../lib/mcp/rutas';

// Solo páginas indexables.
const pages = [
  '/',
  '/equipo',
  '/privacy',
  '/developers/api',
  '/developers/mcp',
  ...serverIds.map(fichaPath),
  ...congressSections.flatMap(({ pages }) =>
    pages.map(([, path]) => `${congressBase}${path ? `/${path}` : ''}`),
  ),
  electionsHref(),
  ...electionOrder.map((id) => electionsHref(id)),
];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((path) => ({ url: new URL(path, siteUrl).href }));
}
