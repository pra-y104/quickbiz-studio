// Flat ESLint configuration for the whole monorepo.
// Kept at the repository root so every workspace shares one rule set.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/.wrangler/**', '**/*.d.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    name: 'quickbiz/base',
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.es2023 },
    },
    rules: {
      'no-console': 'off',
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  {
    // Repository tooling runs in Node, not the browser or a worker.
    name: 'quickbiz/scripts',
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Service worker runs in a worker global scope, not a window.
    name: 'quickbiz/service-worker',
    files: ['apps/web/public/sw.js'],
    languageOptions: {
      globals: { ...globals.serviceworker },
    },
  },
  {
    name: 'quickbiz/api',
    files: ['apps/api/**/*.ts'],
    languageOptions: {
      globals: { ...globals.worker },
    },
  },
  {
    // Test doubles stay out of every production module. Tests and the approved
    // testing directory are exempt, so the fake remains usable offline.
    // Declared before the AI boundary block: flat config replaces rule options
    // when two blocks configure the same rule for the same file.
    name: 'quickbiz/no-ai-test-doubles',
    files: ['apps/api/src/**/*.ts'],
    ignores: ['apps/api/src/__tests__/**', 'apps/api/src/ai/testing/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/ai/testing/*', '**/ai/testing/**', '**/testing/*'],
              message: 'Test doubles must not be imported by production modules.',
            },
          ],
        },
      ],
    },
  },
  {
    // M1A guard: no AI module may reach the network or a vendor SDK.
    // A reviewed adapter in M1B updates this rule deliberately, not silently.
    // The import list repeats the test-double patterns because a later block
    // for the same files would otherwise replace this rule's options.
    name: 'quickbiz/ai-provider-boundary',
    files: ['apps/api/src/ai/**/*.ts'],
    ignores: ['apps/api/src/ai/testing/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'AI modules must not call the network directly in M1A.' },
        { name: 'WebSocket', message: 'AI modules must not open sockets in M1A.' },
        {
          name: 'XMLHttpRequest',
          message: 'AI modules must not call the network directly in M1A.',
        },
        { name: 'EventSource', message: 'AI modules must not open event streams in M1A.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='globalThis'][property.name='fetch']",
          message: 'AI modules must not call globalThis.fetch in M1A.',
        },
        {
          selector: "MemberExpression[object.name='globalThis'][property.name='WebSocket']",
          message: 'AI modules must not open sockets in M1A.',
        },
        {
          selector: "MemberExpression[object.name='globalThis'][property.name='XMLHttpRequest']",
          message: 'AI modules must not call the network directly in M1A.',
        },
        {
          selector: "MemberExpression[object.name='globalThis'][property.name='EventSource']",
          message: 'AI modules must not open event streams in M1A.',
        },
        {
          selector: 'ImportExpression[source.value=/^https?:/]',
          message: 'AI modules must not import remote modules by URL.',
        },
        {
          selector: "ImportExpression[source.type='TemplateLiteral']",
          message: 'AI modules must not build import specifiers dynamically in M1A.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'openai',
                '@google/*',
                '@anthropic-ai/*',
                'groq-sdk',
                'axios',
                'undici',
                'ky',
                'got',
                'node-fetch',
                'node:*',
                'http',
                'https',
                'net',
                'tls',
                'dgram',
              ],
              message:
                'Provider SDKs, HTTP clients and Node networking are not allowed in AI modules.',
            },
            {
              group: ['**/ai/testing/*', '**/ai/testing/**', '**/testing/*'],
              message: 'Test doubles must not be imported by production modules.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'quickbiz/web',
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    name: 'quickbiz/tests',
    files: ['**/*.test.{ts,tsx}', '**/test/**/*.{ts,tsx}', '**/*.setup.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
