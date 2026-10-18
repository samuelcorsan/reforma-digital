import type { Metadata } from 'next';
import { links, siteUrl } from './site';

export const siteName = 'Reforma Digital';

// Imágenes de public/og/, generadas con `pnpm landing:og` a partir de og/template.html.
type OgImage =
  'portada' | 'equipo' | 'privacidad' | 'escritorio' | 'api' | 'congreso' | 'elecciones';

export function pageMetadata({
  title,
  description,
  path,
  og,
  index = true,
}: {
  title: string;
  description: string;
  path: string;
  og: OgImage;
  index?: boolean;
}): Metadata {
  const images = [
    { url: `/og/${og}.jpg`, width: 2400, height: 1260, type: 'image/jpeg', alt: title },
  ];
  return {
    title,
    description,
    alternates: { canonical: path },
    ...(index ? {} : { robots: { index: false, follow: false } }),
    openGraph: {
      title,
      description,
      url: path,
      siteName,
      locale: 'es_ES',
      type: 'website',
      images,
    },
    twitter: { card: 'summary_large_image', title, description, images },
  };
}

export const absolute = (path: string) => new URL(path, siteUrl).href;

export const organizationId = absolute('/#organization');
export const websiteId = absolute('/#website');

export const organization = {
  '@type': 'Organization',
  '@id': organizationId,
  name: siteName,
  url: absolute('/'),
  logo: { '@type': 'ImageObject', url: absolute('/icon-512.png'), width: 512, height: 512 },
  sameAs: [links.repo],
};

export function breadcrumbs(name: string, path: string) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: absolute('/') },
      { '@type': 'ListItem', position: 2, name, item: absolute(path) },
    ],
  };
}

export function webPage({
  type = 'WebPage',
  name,
  description,
  path,
  ...rest
}: {
  type?: string;
  name: string;
  description: string;
  path: string;
  [key: string]: unknown;
}) {
  return {
    '@type': type,
    '@id': absolute(`${path}#webpage`),
    url: absolute(path),
    name,
    description,
    inLanguage: 'es-ES',
    isPartOf: { '@id': websiteId },
    ...rest,
  };
}
