// @ts-check
/**
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
const config = {
  packageManager: 'npm',
  testRunner: 'command',
  commandRunner: {
    command: './scripts/test-for-stryker.sh',
  },
  mutate: [
    'packages/*/src/**/*.ts',
    '!**/*.test.ts',
    '!**/*.spec.ts',
    '!**/*.d.ts',
    '!**/index.ts',
  ],
  ignorePatterns: [
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '**/.stryker-tmp/**',
  ],
  thresholds: {
    high: 95,
    low: 90,
    break: 85,
  },
  reporters: ['html', 'clear-text', 'progress'],
  htmlReporter: {
    fileName: 'reports/mutation/index.html',
  },
  incremental: true,
  incrementalFile: '.stryker-tmp/incremental.json',
  force: false,
  concurrency: 4,
  maxTestRunnerReuse: 0,
  timeoutMS: 30000,
  timeoutFactor: 1.5,
  disableTypeChecks: true,
  clearTextReporter: {
    allowColor: true,
    allowEmojis: true,
    maxTestsToLog: 3,
    reportTests: true,
    reportMutants: true,
    reportScoreTable: true,
  },
  coverageAnalysis: 'perTest',
  checkers: [],
  logLevel: 'info',
  fileLogLevel: 'debug',
  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
  dashboard: {
    project: 'github.com/eduardomenoncello/checklist',
    version: 'main',
    module: 'checklist-core',
    baseUrl: 'https://dashboard.stryker-mutator.io',
    reportType: 'mutationScore',
  },
  warnings: {
    unknownOptions: false,
    preprocessorErrors: true,
    unserializableOptions: true,
    slow: true,
  },
  plugins: ['@stryker-mutator/typescript-checker'],
};

export default config;
