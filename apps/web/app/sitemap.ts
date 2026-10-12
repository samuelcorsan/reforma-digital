import type { MetadataRoute } from 'next';
import { siteUrl } from '../lib/site';

// Solo páginas indexables: /chat y /admin llevan noindex.
const pages = ['/', '/equipo', '/sources', '/elecciones', '/how-it-works', '/privacy'];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((path) => ({ url: new URL(path, siteUrl).href }));
}
