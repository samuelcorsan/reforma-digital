import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { designPostcss } from '@reforma-digital/design/postcss';

/**
 * Each site maps official paths to its fixtures in sites/<id>/fixtures/routes.json:
 *   { "/citaPreviaDni/Inicio.action": "landing.html", "*": "/citaPreviaDni/" }
 * "*" is the path prefix under which unknown screens get a neutral "unadapted" page.
 */
const sitesDir = path.resolve('sites');
const fixtureRoutes = readdirSync(sitesDir).flatMap((id) => {
  const file = path.join(sitesDir, id, 'fixtures', 'routes.json');
  return existsSync(file) ? [{ id, file }] : [];
});

export default defineConfig({
  root: path.resolve('apps/playground'),
  css: {
    postcss: {
      plugins: designPostcss({
        content: [
          `${path.resolve('packages')}/*/src/**/*.{ts,tsx}`,
          `${sitesDir}/*/src/**/*.{ts,tsx}`,
          `${path.resolve('apps/playground')}/**/*.{ts,tsx,html}`,
        ],
      }),
    },
  },
  plugins: [
    react(),
    {
      name: 'synthetic-official-pages',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const route = req.url?.split('?')[0] ?? '';
          for (const { id, file } of fixtureRoutes) {
            const routes = JSON.parse(await readFile(file, 'utf8')) as Record<string, string>;
            const fixture = routes[route];
            if (fixture) {
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(await readFile(path.join(sitesDir, id, 'fixtures', fixture), 'utf8'));
              return;
            }
            if (routes['*'] && route.startsWith(routes['*'])) {
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(
                '<!doctype html><html lang="es"><title>Pantalla desconocida</title><body><h1>Pantalla sin adaptación</h1><input aria-label="Control original"></body></html>',
              );
              return;
            }
          }
          next();
        });
      },
    },
  ],
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    fs: {
      allow: [path.resolve('.')],
      // Vite's defaults (replaced, not merged) plus site:record captures, which hold real cookies.
      deny: [
        '.env',
        '.env.*',
        '*.{crt,pem,key,p12,pfx,cer,der}',
        '.npmrc',
        '.yarnrc.yml',
        '**/.git/**',
        '**/.cache/**',
        '*.har',
      ],
    },
  },
});
