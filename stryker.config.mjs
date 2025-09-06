export default {
  mutate: [
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.test.ts',
    '!packages/*/src/**/*.spec.ts',
    '!packages/*/src/**/index.ts',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/testing/**',
  ],
  testRunner: 'jest',
  jest: {
    projectType: 'custom',
    configFile: undefined,
    config: {
      testEnvironment: 'node',
      testMatch: ['<rootDir>/packages/*/tests/**/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': ['@swc/jest'],
      },
    },
  },
  reporters: ['html', 'clear-text', 'progress'],
  coverageAnalysis: 'perTest',
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
  mutator: {
    plugins: ['@stryker-mutator/typescript-checker'],
  },
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  htmlReporter: {
    fileName: 'coverage/mutation-report.html',
  },
  concurrency: 4,
  timeoutMS: 10000,
  logLevel: 'info',
  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
};
