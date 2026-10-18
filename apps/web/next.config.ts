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
    ];
  },
};
export default config;
