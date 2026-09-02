import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import importX from 'eslint-plugin-import-x';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export const baseConfig = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'import-x': importX },
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports', disallowTypeAnnotations: false },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-floating-promises': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'import-x/no-cycle': ['error', { maxDepth: 6 }],
      'import-x/no-self-import': 'error',
      'import-x/no-duplicates': 'error',
      // Domain boundary rule: modules may import from shared/common, never from another module's internals
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/modules/*/infra/*', '**/modules/*/application/*'],
              message:
                'Import another module through its public index (modules/<name>) instead of its internals.',
            },
          ],
        },
      ],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
    },
  },
  prettier,
  { ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', '**/node_modules/**', '**/generated/**'] },
];

export default baseConfig;
