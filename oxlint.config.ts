import { defineConfig } from 'oxlint';
import antiSlop from 'ultracite/oxlint/anti-slop';

// Network, persistence and dynamic-code APIs the extension bundle must never use.
const extensionForbidden = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'RTCPeerConnection',
  'Image',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'caches',
  'eval',
];

// A failure turned into a default value. `as any` and `as unknown as` are already covered by
// typescript/no-explicit-any and anti-slop/no-chained-type-assertions.
// Returning a typed result that carries the error (`return { error }`) still propagates it.
const defaultValue =
  ":matches([type=/^(Literal|ArrayExpression|ObjectExpression)$/], Identifier[name='undefined']):not(:has(Property[value.type='Identifier']))";
const slopSelectors = [
  {
    selector: `CatchClause[body.body.length=1] > BlockStatement > ReturnStatement > ${defaultValue}.argument`,
    message:
      'This catch only returns a default and hides the error. Rethrow, narrow what you catch, or return the error.',
  },
  {
    selector: `CallExpression[callee.property.name='catch'] > :matches(ArrowFunctionExpression, FunctionExpression) > ${defaultValue}.body`,
    message:
      'This .catch only returns a default and hides the error. Let it reject, narrow what you catch, or return the error.',
  },
];
// Effects synchronize with something outside React; most uses are state that could be derived
// while rendering or work that belongs in the event handler (react.dev, «You Might Not Need an Effect»).
const effectSelector = {
  // The import under another name would hide the call.
  selector:
    'CallExpression:matches([callee.name=/^use(Layout|Insertion)?Effect$/], [callee.property.name=/^use(Layout|Insertion)?Effect$/]), ImportSpecifier[imported.name=/^use(Layout|Insertion)?Effect$/]:not([local.name=/^use(Layout|Insertion)?Effect$/])',
  message:
    'No new effects. Derive the value while rendering, do the work in the event handler, or subscribe with useSyncExternalStore. A hook that really wraps an external system joins the effects list in oxlint.config.ts.',
};

export default defineConfig({
  plugins: ['eslint', 'typescript', 'unicorn', 'react'],
  // Enable only the reviewed rules; do not inherit the full correctness or anti-slop presets.
  // A rule is enabled once the repository has zero findings for it, and only as an error.
  categories: { correctness: 'off' },
  options: { typeAware: true },
  jsPlugins: [
    ...antiSlop.jsPlugins,
    // Oxlint has no native `no-restricted-syntax`; the ESLint compatibility plugin provides it.
    { name: 'eslint-js', specifier: 'oxlint-plugin-eslint' },
    '@shadcn/lint',
  ],
  rules: {
    'eslint/no-debugger': 'error',
    'eslint/no-async-promise-executor': 'error',
    'eslint/no-constant-binary-expression': 'error',
    'eslint/no-dupe-else-if': 'error',
    'eslint/no-fallthrough': 'error',
    'eslint/no-unsafe-finally': 'error',
    'eslint/no-unsafe-optional-chaining': 'error',
    'eslint/use-isnan': 'error',
    'eslint/no-unused-vars': 'error',
    'eslint/no-empty': 'error',
    'eslint/no-useless-catch': 'error',
    'eslint/max-lines': ['error', { max: 800, skipBlankLines: true, skipComments: true }],
    'eslint-js/no-restricted-syntax': ['error', ...slopSelectors, effectSelector],
    'eslint/no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@reforma-digital/design/ui/button',
            importNames: ['buttonVariants'],
            message:
              'Use ButtonLink from @reforma-digital/design/ui/button-link: shadcn/no-restyle checks its classes, and cannot see what is added to buttonVariants().',
          },
          {
            name: 'cn',
            message:
              'Import cn from @reforma-digital/design/lib/utils: the bare one takes text-28 for a color.',
          },
        ],
      },
    ],
    'unicorn/no-useless-fallback-in-spread': 'error',
    'typescript/no-explicit-any': 'error',
    'typescript/ban-ts-comment': 'error',
    // Type-aware: guards, casts and conversions the types already make unnecessary or wrong.
    'typescript/no-unnecessary-condition': 'error',
    'typescript/no-unnecessary-type-assertion': 'error',
    'typescript/no-unnecessary-type-parameters': 'error',
    'typescript/no-unnecessary-type-arguments': 'error',
    'typescript/no-unnecessary-boolean-literal-compare': 'error',
    'typescript/no-unnecessary-template-expression': 'error',
    'typescript/no-redundant-type-constituents': 'error',
    'typescript/no-floating-promises': 'error',
    'typescript/no-misused-promises': 'error',
    'typescript/await-thenable': 'error',
    'typescript/only-throw-error': 'error',
    'typescript/prefer-promise-reject-errors': 'error',
    'typescript/no-base-to-string': 'error',
    'typescript/restrict-template-expressions': 'error',
    'typescript/switch-exhaustiveness-check': 'error',
    'anti-slop/no-chained-type-assertions': 'error',
    'anti-slop/no-widen-then-assert': 'error',
    'anti-slop/no-module-mocking': 'error',
    'anti-slop/no-object-parameters': 'error',
    'anti-slop/no-reflect-apply': 'error',
    'anti-slop/no-reflect-get': 'error',
    'anti-slop/no-unknown-returns': 'error',
    'anti-slop/no-unknown-type-aliases': 'error',
    'shadcn/no-raw-colors': 'error',
    'shadcn/no-unknown-classes': 'error',
    'shadcn/no-arbitrary-values': ['error', { allow: ['layout'] }],
    'shadcn/no-inline-styles': 'error',
    'shadcn/require-static-classes': 'error',
    // A use places a primitive; how it looks belongs to its variants (DESIGN.md §8.5).
    'shadcn/no-restyle': [
      'error',
      {
        allow: ['layout'],
        contracts: [
          // Collapsible ships unstyled: each use dresses its own trigger and panel.
          {
            pattern: '^Collapsible',
            allow: ['layout', 'spacing', 'typography', 'color', 'shape', 'effects', 'motion'],
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // Vendored shadcn primitives keep upstream's values.
      files: ['packages/design/ui/**'],
      rules: {
        'shadcn/no-arbitrary-values': 'off',
        'shadcn/no-restyle': 'off',
        'shadcn/require-static-classes': 'off',
      },
    },
    {
      // The lab form imitates an official portal, whose class names are not Tailwind's.
      files: ['apps/playground/src/main.tsx'],
      rules: { 'shadcn/no-unknown-classes': 'off', 'shadcn/no-restyle': 'off' },
    },
    {
      // Existing debt: these files predate the limit. Split them before adding to them; never add to this list.
      files: [
        'apps/web/components/elecciones/communication.tsx',
        'apps/web/components/elecciones/home.tsx',
        'apps/web/components/elecciones/interview-player.tsx',
        'apps/web/components/elecciones/interviews.tsx',
      ],
      rules: { 'eslint/max-lines': 'off' },
    },
    {
      // Effects that do wrap something outside React: an observer, a listener, a timer or
      // animation frame, a request, focus. Add a file only for one of those.
      files: [
        'apps/extension/src/popup.tsx',
        'apps/web/components/brand/logo-puzle.tsx',
        'apps/web/components/elecciones/could-be.tsx',
        'apps/web/components/elecciones/figures.tsx',
        'apps/web/components/elecciones/first-sight.ts',
        'apps/web/components/elecciones/journeys.tsx',
        'apps/web/components/elecciones/municipal-map.tsx',
        'apps/web/components/elecciones/reparto.tsx',
        'apps/web/components/elecciones/section-nav.tsx',
        'apps/web/components/elecciones/tips.tsx',
        'apps/web/components/elecciones/use-width.ts',
        'apps/web/components/elecciones/video-dock.tsx',
        'apps/web/components/elecciones/years.tsx',
        'apps/web/components/estadisticas.tsx',
        'apps/web/components/prompt-composer.tsx',
        'apps/web/components/route-focus.tsx',
        'packages/design/ui/sidebar.tsx',
        'packages/react/src/index.tsx',
      ],
      rules: { 'eslint-js/no-restricted-syntax': ['error', ...slopSelectors] },
    },
    {
      // Existing debt: effects that should not be effects. Never add to this list.
      // - projection-parts, province-map, your-vote, simulator, vote-story: they repaint by hand a
      //   map the server drew, because it arrives as children instead of as data.
      // - interview-player: state that follows other state (stop at the end, next clip, pan, sound).
      // - preguntar: the search on typing belongs in the input's handler.
      files: [
        'apps/web/components/elecciones/interview-player.tsx',
        'apps/web/components/elecciones/projection-parts.tsx',
        'apps/web/components/elecciones/province-map.tsx',
        'apps/web/components/elecciones/simulator.tsx',
        'apps/web/components/elecciones/vote-story.tsx',
        'apps/web/components/elecciones/your-vote.tsx',
        'apps/web/components/mcp/preguntar.tsx',
      ],
      rules: { 'eslint-js/no-restricted-syntax': ['error', ...slopSelectors] },
    },
    {
      // No tsconfig includes tests/*.ts yet, so they get a default one without strict or
      // noUncheckedIndexedAccess, and these rules would mark the guards it requires as unnecessary.
      // Remove once tests/ has its own tsconfig.
      files: ['tests/*.ts'],
      rules: {
        'typescript/no-unnecessary-condition': 'off',
        'typescript/no-unnecessary-type-assertion': 'off',
        'typescript/no-unnecessary-boolean-literal-compare': 'off',
      },
    },
    {
      // Existing debt: they mock the Congreso data layer until it accepts an injected connection.
      files: ['tests/congreso-data.test.ts', 'tests/congreso-loading.test.ts'],
      rules: { 'anti-slop/no-module-mocking': 'off' },
    },
    {
      // Playwright's fixture callback named `use` is not a React hook.
      files: ['**/*.tsx', '**/*.jsx'],
      rules: {
        'react/rules-of-hooks': 'error',
        'react/exhaustive-deps': 'error',
      },
    },
    {
      // Code bundled into the extension (popup and content scripts). Tests do not ship.
      files: [
        'apps/extension/src/**/*.{ts,tsx}',
        'packages/{bridge,react,runtime,design,registry}/**/*.{ts,tsx}',
        'sites/*/src/**/*.{ts,tsx}',
      ],
      excludeFiles: ['**/*.test.{ts,tsx}'],
      rules: {
        'eslint/no-eval': 'error',
        'eslint/no-new-func': 'error',
        // globalThis/self would allow computed access such as globalThis['fe' + 'tch'].
        'eslint/no-restricted-globals': [
          'error',
          ...extensionForbidden,
          'Function',
          'open',
          'globalThis',
          'self',
        ],
        'eslint/no-restricted-properties': [
          'error',
          ...[...extensionForbidden, 'sendBeacon', 'cookie'].map((property) => ({ property })),
          { object: 'window', property: 'open' },
        ],
      },
    },
  ],
});
