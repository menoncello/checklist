/**
 * Test Console Mock
 * Provides comprehensive console mocking for testing with selective suppression
 */

import { ConsoleCaptureManager } from './ConsoleCaptureManager';

export interface TestConsoleOptions {
  enableCapture?: boolean;
  suppressGlobalOutput?: boolean;
  allowTestReporterOutput?: boolean;
}

export class TestConsoleMock {
  private originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
    debug: typeof console.debug;
  };

  private originalStdoutWrite: typeof process.stdout.write;
  private originalStderrWrite: typeof process.stderr.write;
  private captureManager: ConsoleCaptureManager;
  private options: Required<TestConsoleOptions>;
  private spies: Map<string, any> = new Map();

  constructor(options: TestConsoleOptions = {}) {
    this.options = {
      enableCapture: options.enableCapture ?? false,
      suppressGlobalOutput: options.suppressGlobalOutput ?? true,
      allowTestReporterOutput: options.allowTestReporterOutput ?? true,
    };

    this.captureManager = new ConsoleCaptureManager();

    // Store original methods
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug,
    };

    this.originalStdoutWrite = process.stdout.write;
    this.originalStderrWrite = process.stderr.write;
  }

  /**
   * Install the console mock
   */
  install(): void {
    if (this.options.enableCapture) {
      this.captureManager.enableCapture();
    }

    // Mock console methods
    console.log = (...args: any[]) => {
      this.captureManager.capture('log', ...args);
      if (!this.options.suppressGlobalOutput) {
        this.originalConsole.log(...args);
      }
    };

    console.error = (...args: any[]) => {
      this.captureManager.capture('error', ...args);
      if (!this.options.suppressGlobalOutput) {
        this.originalConsole.error(...args);
      }
    };

    console.warn = (...args: any[]) => {
      this.captureManager.capture('warn', ...args);
      if (!this.options.suppressGlobalOutput) {
        this.originalConsole.warn(...args);
      }
    };

    console.info = (...args: any[]) => {
      this.captureManager.capture('info', ...args);
      if (!this.options.suppressGlobalOutput) {
        this.originalConsole.info(...args);
      }
    };

    console.debug = (...args: any[]) => {
      this.captureManager.capture('debug', ...args);
      if (!this.options.suppressGlobalOutput) {
        this.originalConsole.debug(...args);
      }
    };

    // Mock stdout/stderr if global suppression is enabled
    if (this.options.suppressGlobalOutput) {
      this.mockStdout();
      this.mockStderr();
    }
  }

  /**
   * Uninstall the console mock and restore original methods
   */
  uninstall(): void {
    // Restore console methods
    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;
    console.debug = this.originalConsole.debug;

    // Restore stdout/stderr
    process.stdout.write = this.originalStdoutWrite;
    process.stderr.write = this.originalStderrWrite;

    // Clear spies
    this.spies.clear();

    // Disable capture
    this.captureManager.disableCapture();
  }

  /**
   * Mock stdout to suppress unwanted output
   */
  private mockStdout(): void {
    process.stdout.write = (chunk: any, encoding?: any, callback?: any): boolean => {
      if (typeof chunk === 'string') {
        // Allow test reporter output if enabled
        if (this.options.allowTestReporterOutput && this.isTestReporterOutput(chunk)) {
          return this.originalStdoutWrite.call(process.stdout, chunk, encoding, callback);
        }

        // Suppress all other output
        return true;
      }
      return this.originalStdoutWrite.call(process.stdout, chunk, encoding, callback);
    };
  }

  /**
   * Mock stderr to suppress unwanted output
   */
  private mockStderr(): void {
    process.stderr.write = (chunk: any, encoding?: any, callback?: any): boolean => {
      if (typeof chunk === 'string') {
        // Allow test reporter output if enabled
        if (this.options.allowTestReporterOutput && this.isTestReporterOutput(chunk)) {
          return this.originalStderrWrite.call(process.stderr, chunk, encoding, callback);
        }

        // Suppress all other output
        return true;
      }
      return this.originalStderrWrite.call(process.stderr, chunk, encoding, callback);
    };
  }

  /**
   * Check if output is from test reporter
   */
  private isTestReporterOutput(chunk: string): boolean {
    return (
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
    );
  }

  /**
   * Create a spy for a specific console method (for test assertions)
   */
  spyOnConsole(method: 'log' | 'error' | 'warn' | 'info' | 'debug'): any {
    if (!this.spies.has(method)) {
      const spy = {
        calls: {
          args: [] as any[][],
          count: 0
        },
        mockImplementation: (fn: Function) => {
          const originalMethod = (console as any)[method];
          (console as any)[method] = (...args: any[]) => {
            spy.calls.args.push(args);
            spy.calls.count++;
            this.captureManager.capture(method, ...args);
            return fn(...args);
          };
          return originalMethod;
        },
        mockRestore: () => {
          (console as any)[method] = this.originalConsole[method];
          this.spies.delete(method);
        }
      };
      this.spies.set(method, spy);
    }
    return this.spies.get(method);
  }

  /**
   * Get the capture manager instance
   */
  getCaptureManager(): ConsoleCaptureManager {
    return this.captureManager;
  }

  /**
   * Enable/disable output capture
   */
  setCaptureEnabled(enabled: boolean): void {
    if (enabled) {
      this.captureManager.enableCapture();
    } else {
      this.captureManager.disableCapture();
    }
  }

  /**
   * Get all captured console calls
   */
  getCapturedCalls(): ReturnType<ConsoleCaptureManager['getCapturedOutput']> {
    return this.captureManager.getCapturedOutput();
  }

  /**
   * Get captured calls by method
   */
  getCapturedCallsByMethod(method: 'log' | 'error' | 'warn' | 'info' | 'debug'): any[][] {
    return this.captureManager.getCapturedOutputByMethod(method);
  }

  /**
   * Clear all captured output
   */
  clearCapturedOutput(): void {
    this.captureManager.clearCapturedOutput();
  }

  /**
   * Check if specific output was captured
   */
  wasOutputCaptured(
    method: 'log' | 'error' | 'warn' | 'info' | 'debug',
    searchArgs: any[]
  ): boolean {
    return this.captureManager.findCapturedOutput(method, searchArgs);
  }
}