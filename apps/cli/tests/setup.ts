/**
 * CLI Package Test Setup with Complete Logger Mocking and Console Suppression
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';

// Import core test setup for console suppression
import '../../../packages/core/tests/test-setup';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.PINO_LOG_LEVEL = 'silent';
process.env.CLAUDECODE = '1';

// Store original console methods
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

// Initialize logger mocks
let loggerMock: any;

// Complete console suppression for CLI tests
const suppressConsole = () => {
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  console.info = () => {};
  console.debug = () => {};
};

// Complete stdout/stderr suppression
const suppressOutput = () => {
  const originalWrite = process.stdout.write;
  const originalErrorWrite = process.stderr.write;

  process.stdout.write = function(chunk: any, encoding?: any, callback?: any): boolean {
    // Only allow Bun test reporter output
    if (typeof chunk === 'string' && (
      chunk.includes('pass') ||
      chunk.includes('fail') ||
      chunk.includes('expect') ||
      chunk.includes('Ran') ||
      chunk.includes('test') ||
      chunk.includes('✓') ||
      chunk.includes('✗') ||
      chunk.includes('•') ||
      chunk.includes('expect() calls') ||
      chunk.includes('files') ||
      chunk.includes('ms') ||
      chunk.includes('bun test')
    )) {
      return originalWrite.call(process.stdout, chunk, encoding, callback);
    }
    return true;
  };

  process.stderr.write = function(chunk: any, encoding?: any, callback?: any): boolean {
    // Block all stderr output during CLI tests
    return true;
  };
};

// Global test setup hooks
beforeAll(() => {
  // Apply complete console suppression
  suppressConsole();
  suppressOutput();

  // Import and initialize the TUI logger mock for comprehensive log suppression
  try {
    const { getLoggerMock } = require('../../../packages/tui/tests/test-mocks/TestLoggerMock');
    const { getPinoLoggerMock } = require('../../../packages/tui/tests/test-mocks/PinoLoggerMock');

    loggerMock = getLoggerMock();
    const pinoLoggerMock = getPinoLoggerMock();
  } catch (error) {
    // Logger mocks might not be available, that's fine
    console.log('Logger mocks not available, using console suppression only');
  }
});

afterAll(() => {
  // Restore original console and logger
  loggerMock?.restore();

  // Restore console methods
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;
});

beforeEach(() => {
  // Clear previous log entries
  loggerMock?.clear();
});

// Export for use in CLI tests
export { loggerMock, originalConsole };