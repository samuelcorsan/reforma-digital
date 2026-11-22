import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@reforma-digital/design', '@reforma-digital/db'],
  serverExternalPackages: ['postgres'],
  poweredByHeader: false,
  images: {
    remotePatterns: [
      new URL('https://avatars.githubusercontent.com/u/*?s=640'),
      new URL('https://avatars.githubusercontent.com/u/*?s=160'),
      new URL('https://www.congreso.es/docu/imgweb/diputados/*'),
    ],
  },
  // Para toda la web: nadie la mete en un iframe, el navegador no adivina tipos y los enlaces a
  // otras webs solo llevan el origen. Las cabeceras de CORS de /api/congreso las pone su ruta.
  headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  redirects() {
    return [
      { source: '/explorar', destination: '/', permanent: true },
      { source: '/chat', destination: '/', permanent: true },
      { source: '/sources', destination: '/', permanent: true },
      { source: '/how-it-works', destination: '/', permanent: true },
      { source: '/propuesta', destination: '/#iniciativa', permanent: true },
      { source: '/congreso/elecciones/calendario', destination: '/elecciones', permanent: true },
      { source: '/congreso/elecciones/:path*', destination: '/elecciones/:path*', permanent: true },
      // La documentación vive en /developers. Solo /api exacto: /api/congreso sigue siendo la API.
      { source: '/api', destination: '/developers/api', permanent: true },
      { source: '/mcp', destination: '/developers/mcp', permanent: true },
      { source: '/mcp/servidores/:id', destination: '/developers/mcp/:id', permanent: true },
      // La app de escritorio ya no existe.
      { source: '/escritorio', destination: '/developers/mcp', permanent: true },
      // /developers no es una página: es la sección del menú.
      { source: '/developers', destination: '/developers/api', permanent: false },
    ];
  },
  // Cualquier página de /developers, en Markdown para agentes: la misma ruta con `.md`.
  rewrites() {
    return [{ source: '/developers/:path(.+)\\.md', destination: '/developers/md/:path' }];
  },
};
export default config;
