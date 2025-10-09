/**
 * Simple Console Capture
 * A straightforward console capture utility for testing
 */

export class SimpleConsoleCapture {
  private capturedCalls: Array<{
    method: 'log' | 'error' | 'warn' | 'info' | 'debug';
    args: any[];
  }> = [];

  private originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
    debug: typeof console.debug;
  };

  private isCapturing = false;

  constructor() {
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug,
    };
  }

  /**
   * Start capturing console output
   */
  startCapture(): void {
    if (this.isCapturing) {
      return;
    }

    this.isCapturing = true;
    this.capturedCalls = [];

    // Override console methods to capture calls
    console.log = (...args: any[]) => {
      this.capturedCalls.push({ method: 'log', args });
      // Call original to maintain output during debug
      // this.originalConsole.log(...args);
    };

    console.error = (...args: any[]) => {
      this.capturedCalls.push({ method: 'error', args });
      // this.originalConsole.error(...args);
    };

    console.warn = (...args: any[]) => {
      this.capturedCalls.push({ method: 'warn', args });
      // this.originalConsole.warn(...args);
    };

    console.info = (...args: any[]) => {
      this.capturedCalls.push({ method: 'info', args });
      // this.originalConsole.info(...args);
    };

    console.debug = (...args: any[]) => {
      this.capturedCalls.push({ method: 'debug', args });
      // this.originalConsole.debug(...args);
    };
  }

  /**
   * Stop capturing and restore original console
   */
  stopCapture(): void {
    if (!this.isCapturing) {
      return;
    }

    // Restore original methods
    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;
    console.debug = this.originalConsole.debug;

    this.isCapturing = false;
  }

  /**
   * Check if a specific console call was made
   */
  wasCalled(method: 'log' | 'error' | 'warn' | 'info' | 'debug', ...searchArgs: any[]): boolean {
    return this.capturedCalls.some(call => {
      if (call.method !== method) {
        return false;
      }

      if (searchArgs.length === 0) {
        return true;
      }

      if (call.args.length !== searchArgs.length) {
        return false;
      }

      return call.args.every((arg, index) => {
        const searchArg = searchArgs[index];
        if (typeof arg === 'string' && typeof searchArg === 'string') {
          return arg.includes(searchArg);
        }
        return arg === searchArg;
      });
    });
  }

  /**
   * Get all captured calls for a specific method
   */
  getCalls(method: 'log' | 'error' | 'warn' | 'info' | 'debug'): any[][] {
    return this.capturedCalls
      .filter(call => call.method === method)
      .map(call => call.args);
  }

  /**
   * Get all captured calls
   */
  getAllCalls(): Array<{ method: string; args: any[] }> {
    return [...this.capturedCalls];
  }

  /**
   * Clear all captured calls
   */
  clear(): void {
    this.capturedCalls = [];
  }

  /**
   * Get the number of captured calls
   */
  getCallCount(method?: 'log' | 'error' | 'warn' | 'info' | 'debug'): number {
    if (!method) {
      return this.capturedCalls.length;
    }
    return this.capturedCalls.filter(call => call.method === method).length;
  }

  /**
   * Check if currently capturing
   */
  isActive(): boolean {
    return this.isCapturing;
  }
}