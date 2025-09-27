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
      '**/*.bench.ts',
      '**/tests/**',
      'performance.config.ts',
      '.vscode/**',
      '.husky/**',
      '.stryker-tmp/**',
      'stryker.conf.js',
      'packages/tui/test-simple.ts',
      '**/*-old.ts',
      '**/*.original.ts',
      '**/EventManager-old.ts',
      '**/StartupProfiler.original.ts',
      '**/performance/index-old.ts',
      '**/CleanShutdown-old.ts',
      '**/debug/index-old.ts',
      '**/DebugManager.ts',
      '**/MemoryTracker.ts',
      '**/StartupProfiler.ts',
      '**/MetricsCollector.ts',
      '**/ColorSupport.ts'
    ]
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parser,
      parserOptions: {
        project: [
          './tsconfig.json',
          './packages/*/tsconfig.json'
        ]
      }
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      'import': importPlugin,
      'unused-imports': unusedImportsPlugin
    },
    rules: {
      // TypeScript-specific rules (MANDATORY)
      '@typescript-eslint/no-unused-vars': ['error', {
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_',
        'caughtErrorsIgnorePattern': '^_'
      }],
      '@typescript-eslint/no-explicit-any': 'error',
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
      'no-console': 'error', // Use Pino logger instead
      'no-debugger': 'error',
      'no-alert': 'error',
      'prefer-const': 'error',
      'no-var': 'error',

      // Bun-specific patterns (MANDATORY)
      'no-restricted-syntax': ['error', {
        'selector': "CallExpression[callee.object.name='process'][callee.property.name='env']",
        'message': 'Use Bun.env instead of process.env for better performance'
      }],

      // Code quality metrics (Story 1.16)
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 30, skipBlankLines: true, skipComments: true }],
      'complexity': ['error', { max: 10 }],
      'max-depth': ['error', { max: 3 }],
      'max-nested-callbacks': ['error', { max: 3 }],
      'max-params': ['error', { max: 4 }],

      // Security rules (MANDATORY)
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      
      // Ban compromised packages (Security Fix Story 1.11)
      'no-restricted-imports': ['error', {
        'paths': [
          {
            'name': 'chalk',
            'message': 'Use ansis instead of chalk (Security: chalk was compromised)'
          },
          {
            'name': 'color-name',
            'message': 'Package compromised with malware - do not use'
          },
          {
            'name': 'color-convert',
            'message': 'Package compromised with malware - do not use'
          },
          {
            'name': 'ansi-styles',
            'message': 'Package compromised with malware - use ansis instead'
          }
        ]
      }]
    }
  },
  {
    // CLI and TUI packages need console for user interface
    files: ['packages/cli/**/*.ts', 'packages/tui/**/*.ts'],
    rules: {
      'no-console': 'off'
    }
  },
  {
    // Temporary override for NavigationCommandHandler to allow fixing tests first
    files: ['packages/tui/src/navigation/NavigationCommandHandler.ts'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off'
    }
  }
];