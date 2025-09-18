// Type definitions for stryker.conf.js
export interface StrykerConfig {
  packageManager: string;
  testRunner: string;
  commandRunner: {
    command: string;
  };
  mutate: string[];
  ignorePatterns: string[];
  thresholds: {
    high: number;
    low: number;
    break: number;
  };
  reporters: string[];
  htmlReporter: {
    fileName: string;
  };
  jsonReporter: {
    fileName: string;
  };
  incremental: boolean;
  incrementalFile: string;
  force: boolean;
  concurrency: number;
  maxTestRunnerReuse: number;
  timeoutMS: number;
  timeoutFactor: number;
  disableTypeChecks: boolean;
  clearTextReporter: {
    allowColor: boolean;
    allowEmojis: boolean;
    maxTestsToLog: number;
    reportTests: boolean;
    reportMutants: boolean;
    reportScoreTable: boolean;
  };
  coverageAnalysis: string;
  checkers: unknown[];
  logLevel: string;
  fileLogLevel: string;
  tempDirName: string;
  cleanTempDir: boolean;
  dashboard: {
    project: string;
    version: string;
    module: string;
    baseUrl: string;
    reportType: string;
  };
  warnings: {
    unknownOptions: boolean;
    preprocessorErrors: boolean;
    unserializableOptions: boolean;
    slow: boolean;
  };
  plugins: string[];
}