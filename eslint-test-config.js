import typescriptEslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';

// Test configuration with quality rules enabled for CI validation tests
export default [
  {
    files: ['temp-violation-test.ts'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      // Enable quality rules for testing CI failure behavior
      'max-lines': [
        'error',
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
      'max-lines-per-function': [
        'error',
        { max: 30, skipBlankLines: true, skipComments: true },
      ],
      complexity: ['error', { max: 10 }],
      'max-depth': ['error', { max: 3 }],
      'max-nested-callbacks': ['error', { max: 3 }],
      'max-params': ['error', { max: 4 }],
    },
  },
];
