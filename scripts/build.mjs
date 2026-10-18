import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { designPostcss } from '@reforma-digital/design/postcss';
import { readSites, adapterPlugin, testMatches } from './sites.mjs';

const test = process.argv.includes('--test');
const outDir = path.resolve(test ? 'dist-test' : 'dist');
const sites = await readSites();
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const shared = ['packages/design/src', 'packages/react/src', 'packages/runtime/src'].map(
  (dir) => `${path.resolve(dir)}/**/*.{ts,tsx}`,
);

// Popup (React + design system). Knows the included sites for its "Portales incluidos" list.
await build({
  configFile: false,
  logLevel: 'warn',
  root: path.resolve('apps/extension'),
  plugins: [react()],
  css: {
    postcss: {
      plugins: designPostcss({
        content: [...shared, `${path.resolve('apps/extension')}/**/*.{ts,tsx,html}`],
      }),
    },
  },
  define: {
    __BG_SITES__: JSON.stringify(
      sites.map(({ id, name, homepage, status }) => ({ id, name, homepage, status })),
    ),
  },
  build: {
    outDir,
    emptyOutDir: true,
    sourcemap: false,
    modulePreload: false,
    rollupOptions: { input: path.resolve('apps/extension/popup.html') },
  },
});

// One content script per site: each official page loads only its own adapter.
for (const site of sites) {
  await build({
    configFile: false,
    logLevel: 'warn',
    plugins: [react(), adapterPlugin(site)],
    css: {
      postcss: {
        plugins: designPostcss({
          content: [...shared, `${path.resolve('sites', site.id, 'src')}/**/*.{ts,tsx}`],
        }),
      },
    },
    define: { __BG_TEST__: JSON.stringify(test), 'process.env.NODE_ENV': '"production"' },
    build: {
      outDir,
      emptyOutDir: false,
      sourcemap: false,
      lib: {
        entry: path.resolve('apps/extension/src/content.ts'),
        name: 'BetterGovernment',
        formats: ['iife'],
        fileName: () => `content/${site.id}.js`,
      },
    },
  });
}

await mkdir(outDir, { recursive: true });
await writeFile(
  path.join(outDir, 'manifest.json'),
  JSON.stringify(
    {
      manifest_version: 3,
      name: test ? 'Reforma Digital · Test' : 'Reforma Digital',
      version: pkg.version,
      description:
        'Interfaces comunitarias para trámites públicos. Procesamiento local, sin telemetría.',
      minimum_chrome_version: '120',
      permissions: ['storage'],
      action: { default_popup: 'popup.html', default_title: 'Reforma Digital' },
      content_scripts: sites.map((site) => ({
        matches: test ? [...site.matches, ...testMatches(site)] : site.matches,
        js: [`content/${site.id}.js`],
        run_at: 'document_idle',
        all_frames: false,
        world: 'ISOLATED',
      })),
      content_security_policy: {
        extension_pages:
          "default-src 'none'; script-src 'self'; style-src 'self'; object-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'",
      },
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Extension built in ${outDir}. ${sites.length} site adapter(s): ${sites.map((s) => s.id).join(', ')}.`,
);
