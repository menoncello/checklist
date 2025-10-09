/**
 * Core Package Test Setup with Complete Logger Mocking
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';

// Set test environment IMMEDIATELY
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.PINO_LOG_LEVEL = 'silent';

// Initialize logger mocks IMMEDIATELY to catch early logging
const { getLoggerMock } = require('../../tui/tests/test-mocks/TestLoggerMock');
const { getPinoLoggerMock } = require('../../tui/tests/test-mocks/PinoLoggerMock');

let loggerMock: any;
let pinoLoggerMock: any;

// Setup mocks immediately during module loading
loggerMock = getLoggerMock();
pinoLoggerMock = getPinoLoggerMock();

// Global test setup hooks
beforeAll(() => {
  // Ensure mocks are still active (in case they were reset)
  if (!loggerMock) {
    loggerMock = getLoggerMock();
  }
  if (!pinoLoggerMock) {
    pinoLoggerMock = getPinoLoggerMock();
  }
});

afterAll(() => {
  // Restore original console and logger
  loggerMock?.restore();
  pinoLoggerMock?.restore();
});

beforeEach(() => {
  // Clear previous log entries
  loggerMock?.clear();
  pinoLoggerMock?.clear();
});

// Export for use in core tests
export { loggerMock, pinoLoggerMock };