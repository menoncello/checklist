import typescriptEslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '*.config.js',
      '*.config.ts',
      'examples/**',
      'bun.lockb',
      '**/~/**',
      '**/.bun/**',
      'scripts/**',
      'test-setup.ts',
      '**/*.test.ts',
      '**/*.spec.ts',
      'tests/**',
      'performance.config.ts',
      '.vscode/**',
      '.husky/**',
      'packages/tui/spike/**'
    ]
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parser,
      parserOptions: {
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      'import': importPlugin,
      'unused-imports': unusedImportsPlugin
    },
    rules: {
      // TypeScript-specific rules (MANDATORY)
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',

      // Import organization (MANDATORY)
      'import/order': ['error', {
        'groups': [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index'
        ],
        'alphabetize': { 'order': 'asc' }
      }],
      'unused-imports/no-unused-imports': 'error',

      // Code quality (MANDATORY)
      'no-console': 'warn', // Use debug logger instead
      'no-debugger': 'error',
      'no-alert': 'error',
      'prefer-const': 'error',
      'no-var': 'error',

      // Bun-specific patterns (MANDATORY)
      'no-restricted-syntax': ['error', {
        'selector': "CallExpression[callee.object.name='process'][callee.property.name='env']",
        'message': 'Use Bun.env instead of process.env for better performance'
      }],

      // Security rules (MANDATORY)
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error'
    }
  }
];