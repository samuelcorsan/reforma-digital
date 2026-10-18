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

export default defineConfig({
  plugins: ['eslint', 'react'],
  // Enable only the reviewed rules; do not inherit the full correctness or anti-slop presets.
  categories: { correctness: 'off' },
  jsPlugins: antiSlop.jsPlugins,
  rules: {
    'eslint/no-debugger': 'error',
    'eslint/no-async-promise-executor': 'error',
    'eslint/no-constant-binary-expression': 'error',
    'eslint/no-dupe-else-if': 'error',
    'eslint/no-fallthrough': 'error',
    'eslint/no-unsafe-finally': 'error',
    'eslint/no-unsafe-optional-chaining': 'error',
    'eslint/use-isnan': 'error',
    'anti-slop/no-chained-type-assertions': 'error',
    'anti-slop/no-widen-then-assert': 'error',
  },
  overrides: [
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
