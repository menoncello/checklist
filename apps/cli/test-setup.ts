/**
 * CLI Test setup - runs before CLI tests to suppress console output
 * Inherits core test suppression and adds CLI-specific configurations
 */

// Import the core test setup to inherit console suppression
import '../../packages/core/tests/test-setup';
import { createConsoleTestHelper } from '../../packages/core/tests/utils';

// Create CLI-specific console helper
export const cliConsoleHelper = createConsoleTestHelper();

// CLI tests should use the helper for console assertions
// Example usage in tests:
// cliConsoleHelper.startCapture();
// // ... run code that logs to console
// const output = cliConsoleHelper.stopCapture();
// expect(cliConsoleHelper.wasCalled('log', 'Expected message')).toBe(true);
