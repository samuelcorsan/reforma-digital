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

const restyleAllow = ['layout', 'gap-*', 'font-sans', 'font-mono', 'tabular-nums'];
const restyleAny = [
  ...restyleAllow,
  'spacing',
  'typography',
  'color',
  'shape',
  'effects',
  'motion',
];

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
    'eslint-js/no-restricted-syntax': ['error', ...slopSelectors],
    'eslint/no-restricted-imports': [
      'error',
      {
        paths: [
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
    // `transition`: a list of properties to animate is not a design value.
    'shadcn/no-arbitrary-values': ['error', { allow: ['layout', 'transition'] }],
    'shadcn/no-inline-styles': 'error',
    'shadcn/require-static-classes': 'error',
    // Uses compose primitives: where they go, the gap between their children and numeric type.
    // Colours, radii and sizes belong to the primitive's variants (DESIGN.md §8.5).
    'shadcn/no-restyle': [
      'error',
      {
        allow: restyleAllow,
        contracts: [
          // Collapsible ships unstyled: each use dresses its own trigger and panel.
          { pattern: '^Collapsible', allow: restyleAny },
          // A grid of options with no surface of its own.
          { pattern: '^RadioGroup$', allow: [...restyleAllow, 'spacing'] },
          // Cells hold content: each table sets its density, its type and a muted tone, and may
          // drop the rules between rows.
          {
            pattern: '^Table',
            allow: [...restyleAllow, 'spacing', 'typography', 'text-muted-foreground', 'border-0'],
          },
          // The sidebar is a frame: each use sets its density and type, and may drop its
          // surface and the rule beside a submenu.
          {
            pattern: '^Sidebar',
            allow: [...restyleAllow, 'spacing', 'typography', 'bg-transparent', 'border-0'],
          },
          // Not migrated yet. Empty this list one family per PR; never add to it.
          { pattern: '^Card', allow: restyleAny },
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
      // One-off surfaces, each a single use: the full-screen menu on the sun gradient, the pill
      // that asks the MCP library and the code samples on ink. A variant would have one consumer.
      files: [
        'apps/web/components/brand/mobile-menu.tsx',
        'apps/web/components/mcp/preguntar.tsx',
        'apps/web/components/code-block.tsx',
      ],
      rules: { 'shadcn/no-restyle': 'off' },
    },
    {
      // The header, a one-off: its glass pills (links and the menu trigger) share one string
      // built on buttonVariants(), which the linter cannot read across files, and its menu panel
      // sets its own padding and radius.
      files: ['apps/web/components/brand/header.tsx'],
      rules: { 'shadcn/no-restyle': 'off', 'shadcn/require-static-classes': 'off' },
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
