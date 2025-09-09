/**
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
module.exports = {
  // Package manager configuration (required for StrykerJS)
  packageManager: 'npm',

  // Use command runner to execute Bun tests
  testRunner: 'command',
  commandRunner: {
    // Run only unit tests, excluding integration tests
    command:
      'STRYKER_MUTATOR_RUNNER=true bun test --test-name-pattern="^(?!.*Integration)"',
  },

  // Files to mutate - exclude test files and type definitions
  mutate: [
    'packages/*/src/**/*.ts',
    '!**/*.test.ts',
    '!**/*.spec.ts',
    '!**/*.d.ts',
    '!**/index.ts', // Often just re-exports
    '!**/~/**', // Exclude any tilde directories
  ],

  // Ignore patterns for file copying
  ignorePatterns: [
    '~/**',
    '.bun/**',
    'node_modules/**/.git/**',
    '**/*.sock',
    '**/*.socket',
  ],

  // Mutation score thresholds
  thresholds: {
    high: 95,
    low: 90,
    break: 85, // CI will fail if score falls below this
  },

  // Reporters for output
  reporters: ['html', 'json', 'progress', 'clear-text'],

  // HTML reporter configuration
  htmlReporter: {
    fileName: 'reports/mutation/index.html',
  },

  // JSON reporter configuration
  jsonReporter: {
    fileName: 'reports/mutation/mutation-report.json',
  },

  // Enable incremental testing for faster PR validation
  incremental: true,
  incrementalFile: '.stryker-tmp/incremental.json',

  // Performance settings
  concurrency: 4,
  maxTestRunnerReuse: 0, // Disable reuse for Bun compatibility

  // Timeout settings (in milliseconds)
  timeoutMS: 60000,
  timeoutFactor: 1.5,

  // Disable type checking (Bun handles this)
  disableTypeChecks: false,

  // Clear text reporter for better CI output
  clearTextReporter: {
    allowColor: true,
    allowEmojis: true,
    maxTestsToLog: 3,
    reportTests: true,
    reportMutants: true,
    reportScoreTable: true,
  },

  // Coverage analysis (speeds up mutation testing)
  coverageAnalysis: 'perTest',

  // Logging
  logLevel: 'info',
  fileLogLevel: 'debug',

  // Temporary directory
  tempDirName: '.stryker-tmp',

  // Clean up temporary files after run
  cleanTempDir: true,

  // Dashboard configuration (will be enabled when token is available)
  dashboard: {
    project: 'github.com/eduardomenoncello/checklist',
    version: process.env.GITHUB_REF_NAME || 'local',
    module: 'checklist-core',
    baseUrl: 'https://dashboard.stryker-mutator.io/api/reports',
    reportType: 'mutationScore',
  },

  // Enable all default mutators (mutator.name deprecated in v9)

  // Warning settings
  warnings: {
    unknownOptions: true,
    preprocessorErrors: true,
    unserializableOptions: true,
    slow: true,
  },

  // Plugins (none needed for command runner)
  plugins: [],
};
