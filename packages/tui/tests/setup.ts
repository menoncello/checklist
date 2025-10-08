/**
 * TUI Package Test Setup with Complete Logger Mocking
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { TestIsolationManager, isolateTest, isolateCompletely, verifyNoProcessListeners } from './test-isolation';
import { getLoggerMock, resetLoggerMock, MockLogger } from './test-mocks/TestLoggerMock';
import { getPinoLoggerMock, resetPinoLoggerMock } from './test-mocks/PinoLoggerMock';

// Initialize logger mocks
let loggerMock: MockLogger;
let pinoLoggerMock: any;

// Initialize isolation manager
const isolationManager = TestIsolationManager.getInstance();

// Set test environment immediately at module load time
process.env.NODE_ENV = 'test';
Bun.env.NODE_ENV = 'test';

// Global test setup hooks
beforeAll(() => {
  // Ensure test environment is set before mocks
  process.env.NODE_ENV = 'test';
  Bun.env.NODE_ENV = 'test';

  // Initialize logger mocks FIRST before any other code runs
  loggerMock = getLoggerMock();
  pinoLoggerMock = getPinoLoggerMock();

  // Backup the initial state of process listeners
  isolationManager.backupProcessListeners();
});

afterAll(() => {
  // Clean up any remaining process listeners after all tests
  isolationManager.cleanupProcessListeners();

  // Restore original console and logger
  loggerMock?.restore();
  pinoLoggerMock?.restore();
});

beforeEach(() => {
  // Clear previous log entries
  loggerMock?.clear();
  pinoLoggerMock?.clear();

  // Ensure clean state before each test
  isolationManager.cleanupProcessListeners();
});

afterEach(() => {
  // Verify no process listeners leaked after each test
  verifyNoProcessListeners();

  // Clean up any test-specific state
  isolationManager.resetTestState();
});

// Export logger mocks for use in tests
export { loggerMock, pinoLoggerMock };

// Export isolation helpers for individual test files
export { isolateTest, isolateCompletely, verifyNoProcessListeners, TestIsolationManager };

// Export logger mock classes for custom usage
export { TestLoggerMock } from './test-mocks/TestLoggerMock';
export { PinoLoggerMock } from './test-mocks/PinoLoggerMock';

// Export utility functions
export { getLoggerMock, resetLoggerMock } from './test-mocks/TestLoggerMock';
export { getPinoLoggerMock, resetPinoLoggerMock } from './test-mocks/PinoLoggerMock';