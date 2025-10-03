/**
 * TUI Package Test Setup with Process Isolation
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { TestIsolationManager, isolateTest, isolateCompletely, verifyNoProcessListeners } from './test-isolation';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.PINO_LOG_LEVEL = 'silent';

// Initialize isolation manager
const isolationManager = TestIsolationManager.getInstance();

// Store original methods for selective suppression
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

// Only suppress specific JSON logging output, preserve test functionality
const originalLog = console.log;
console.log = (...args) => {
  const str = args.join(' ');

  // Only suppress JSON logs and specific application logs
  if (str.startsWith('{"level":') ||
      str.includes('"module":') ||
      str.includes('"traceId":') ||
      str.includes('Initializing state system') ||
      str.includes('Creating new state file') ||
      str.includes('Cleaning up state manager resources') ||
      str.includes('Panic Recovery initialized') ||
      str.includes('Shutting down Panic Recovery') ||
      str.includes('Performance Monitor initialized')) {
    return;
  }

  originalLog.apply(console, args);
};

// Only suppress specific error logging, preserve test errors
const originalError = console.error;
console.error = (...args) => {
  const str = args.join(' ');

  // Only suppress JSON error logs and specific application logs
  if (str.startsWith('{"level":') ||
      str.includes('"module":') ||
      str.includes('"traceId":') ||
      str.includes('Backup restoration failed') ||
      str.includes('Error in error hook:') ||
      str.includes('Error in error handler:')) {
    return;
  }

  originalError.apply(console, args);
};

// Preserve other console methods
console.warn = originalConsole.warn;
console.info = originalConsole.info;
console.debug = originalConsole.debug;

// Global test setup hooks
beforeAll(() => {
  // Backup the initial state of process listeners
  isolationManager.backupProcessListeners();
});

afterAll(() => {
  // Clean up any remaining process listeners after all tests
  isolationManager.cleanupProcessListeners();
});

beforeEach(() => {
  // Ensure clean state before each test
  isolationManager.cleanupProcessListeners();
});

afterEach(() => {
  // Verify no process listeners leaked after each test
  verifyNoProcessListeners();

  // Clean up any test-specific state
  isolationManager.resetTestState();
});

// Export isolation helpers for individual test files
export { isolateTest, isolateCompletely, verifyNoProcessListeners, TestIsolationManager };

// Export original console for tests that need it
export { originalConsole };