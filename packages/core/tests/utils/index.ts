/**
 * Test Utilities Index
 * Central export point for all test utilities
 */

export { ConsoleCaptureManager } from './ConsoleCaptureManager';
export { TestConsoleMock } from './TestConsoleMock';
export { SimpleConsoleCapture } from './SimpleConsoleCapture';
export {
  TestLoggerSuppressor,
  installTestSuppression,
  uninstallTestSuppression,
  createConsoleTestHelper
} from './TestLoggerSuppressor';

// Re-export commonly used types
export type { TestConsoleOptions } from './TestConsoleMock';
export type { GlobalTestSuppressorOptions } from './TestLoggerSuppressor';