/**
 * Test Logger Suppressor
 * Global logger suppression for clean test output
 */

import { TestConsoleMock } from './TestConsoleMock';

export interface GlobalTestSuppressorOptions {
  enableCapture?: boolean;
  suppressAllOutput?: boolean;
  allowTestReporter?: boolean;
  customPatterns?: string[];
}

export class TestLoggerSuppressor {
  private static instance: TestLoggerSuppressor;
  private consoleMock: TestConsoleMock | null = null;
  private isInstalled = false;

  private constructor(private options: GlobalTestSuppressorOptions = {}) {}

  /**
   * Get singleton instance
   */
  static getInstance(options?: GlobalTestSuppressorOptions): TestLoggerSuppressor {
    if (!TestLoggerSuppressor.instance) {
      TestLoggerSuppressor.instance = new TestLoggerSuppressor(options);
    }
    return TestLoggerSuppressor.instance;
  }

  /**
   * Install global console suppression
   */
  installGlobalSuppression(): void {
    if (this.isInstalled) {
      return;
    }

    // Force test environment
    process.env.NODE_ENV = 'test';
    Bun.env.NODE_ENV = 'test';
    Bun.env.LOG_LEVEL = 'silent';
    Bun.env.ENABLE_FILE_LOGGING = 'false';

    this.consoleMock = new TestConsoleMock({
      enableCapture: this.options.enableCapture ?? true,
      suppressGlobalOutput: this.options.suppressAllOutput ?? true,
      allowTestReporterOutput: this.options.allowTestReporter ?? true,
    });

    this.consoleMock.install();
    this.isInstalled = true;
  }

  /**
   * Uninstall global console suppression
   */
  uninstallGlobalSuppression(): void {
    if (this.consoleMock) {
      this.consoleMock.uninstall();
      this.consoleMock = null;
    }
    this.isInstalled = false;
  }

  /**
   * Get the console mock instance for test access
   */
  getConsoleMock(): TestConsoleMock | null {
    return this.consoleMock;
  }

  /**
   * Enable output capture for specific tests
   */
  enableTestCapture(): void {
    if (this.consoleMock) {
      this.consoleMock.setCaptureEnabled(true);
      this.consoleMock.clearCapturedOutput();
    }
  }

  /**
   * Disable output capture
   */
  disableTestCapture(): void {
    if (this.consoleMock) {
      this.consoleMock.setCaptureEnabled(false);
    }
  }

  /**
   * Get captured output for test assertions
   */
  getCapturedOutput() {
    return this.consoleMock?.getCapturedCalls() || [];
  }

  /**
   * Clear captured output
   */
  clearCapturedOutput(): void {
    this.consoleMock?.clearCapturedOutput();
  }

  /**
   * Create a test-specific console spy
   */
  spyOnConsole(method: 'log' | 'error' | 'warn' | 'info' | 'debug') {
    return this.consoleMock?.spyOnConsole(method);
  }

  /**
   * Check if suppression is installed
   */
  isSuppressionInstalled(): boolean {
    return this.isInstalled;
  }
}

/**
 * Convenience function to install global test suppression
 */
export function installTestSuppression(options?: GlobalTestSuppressorOptions): TestLoggerSuppressor {
  const suppressor = TestLoggerSuppressor.getInstance(options);
  suppressor.installGlobalSuppression();
  return suppressor;
}

/**
 * Convenience function to uninstall global test suppression
 */
export function uninstallTestSuppression(): void {
  const suppressor = TestLoggerSuppressor.getInstance();
  suppressor.uninstallGlobalSuppression();
}

/**
 * Test helper function for clean console testing
 */
export function createConsoleTestHelper() {
  const suppressor = TestLoggerSuppressor.getInstance();

  return {
    // Start capturing console output for a test
    startCapture: () => {
      suppressor.enableTestCapture();
      suppressor.clearCapturedOutput();
    },

    // Stop capturing and get results
    stopCapture: () => {
      suppressor.disableTestCapture();
      return suppressor.getCapturedOutput();
    },

    // Get console spy for assertions
    spyOn: (method: 'log' | 'error' | 'warn' | 'info' | 'debug') => {
      return suppressor.spyOnConsole(method);
    },

    // Check if specific output was captured
    wasCalled: (method: 'log' | 'error' | 'warn' | 'info' | 'debug', ...args: any[]) => {
      return suppressor.getConsoleMock()?.wasOutputCaptured(method, args) ?? false;
    },

    // Get all captured calls by method
    getCalls: (method: 'log' | 'error' | 'warn' | 'info' | 'debug') => {
      return suppressor.getConsoleMock()?.getCapturedCallsByMethod(method) ?? [];
    }
  };
}