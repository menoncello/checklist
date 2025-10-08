/**
 * Test setup - runs before all tests to configure test environment
 * Uses new console mocking utilities for cleaner output
 */

import { installTestSuppression, createConsoleTestHelper } from './utils';

// Install global test suppression for clean output
installTestSuppression({
  enableCapture: true, // Enable capture for tests that need to verify console output
  suppressAllOutput: true, // Suppress all output by default
  allowTestReporter: true, // Allow test reporter output
});

// Export the original console for tests that need it
export const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

// Export a helper function for tests to use console capture
export const testConsole = createConsoleTestHelper();

// Set test environment variables
Bun.env.NODE_ENV = 'test';
process.env.NODE_ENV = 'test';
Bun.env.LOG_LEVEL = 'silent';
Bun.env.ENABLE_FILE_LOGGING = 'false';