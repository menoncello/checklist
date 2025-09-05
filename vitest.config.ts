import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '**/dist/**',
        '**/*.config.ts',
        '**/*.config.js',
        '**/*.test.ts',
        '**/*.spec.ts',
        'packages/*/tests/**',
        'examples/**',
        'scripts/**',
        '.prettierrc.js',
        'eslint.config.js',
      ],
      include: ['packages/*/src/**/*.ts'],
    },
  },
  resolve: {
    alias: {
      '@checklist/core': path.resolve(__dirname, './packages/core/src'),
      '@checklist/cli': path.resolve(__dirname, './packages/cli/src'),
      '@checklist/tui': path.resolve(__dirname, './packages/tui/src'),
      '@checklist/shared': path.resolve(__dirname, './packages/shared/src'),
    },
  },
});
