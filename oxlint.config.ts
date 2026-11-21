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

// Patterns agents use to make a type error or a failure disappear instead of fixing it.
const slopSelectors = [
  {
    selector: 'TSAsExpression > TSAnyKeyword',
    message:
      '`as any` disables type checking. Narrow the type or validate the value at its boundary.',
  },
  {
    selector: 'TSAsExpression > TSAsExpression',
    message:
      '`as unknown as X` launders an incompatible type. Model the real shape or convert explicitly.',
  },
  {
    // Returning a typed result that carries the error (`return { error }`) still propagates it.
    selector:
      "CatchClause[body.body.length=1] > BlockStatement > ReturnStatement[argument.type=/^(Literal|ArrayExpression|ObjectExpression)$/]:not(:has(Property[value.type='Identifier']))",
    message:
      'This catch only returns a default and hides the error. Rethrow, narrow what you catch, or return the error.',
  },
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
  },
  overrides: [
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
