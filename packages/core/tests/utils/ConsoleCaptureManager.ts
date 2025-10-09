/**
 * Console Capture Manager
 * Provides selective console output capture for testing
 */

export class ConsoleCaptureManager {
  private isCapturing = false;
  private capturedOutput: Array<{
    method: 'log' | 'error' | 'warn' | 'info' | 'debug';
    args: any[];
    timestamp: number;
  }> = [];

  /**
   * Start capturing console output
   */
  enableCapture(): void {
    this.isCapturing = true;
    this.capturedOutput = [];
  }

  /**
   * Stop capturing console output
   */
  disableCapture(): void {
    this.isCapturing = false;
  }

  /**
   * Capture a console call if capturing is enabled
   */
  capture(method: 'log' | 'error' | 'warn' | 'info' | 'debug', ...args: any[]): void {
    if (this.isCapturing) {
      this.capturedOutput.push({
        method,
        args: args.map(arg =>
          typeof arg === 'object' ? JSON.parse(JSON.stringify(arg)) : arg
        ),
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get all captured output
   */
  getCapturedOutput(): Array<{
    method: 'log' | 'error' | 'warn' | 'info' | 'debug';
    args: any[];
    timestamp: number;
  }> {
    return [...this.capturedOutput];
  }

  /**
   * Get captured output filtered by method
   */
  getCapturedOutputByMethod(method: 'log' | 'error' | 'warn' | 'info' | 'debug'): any[][] {
    return this.capturedOutput
      .filter(entry => entry.method === method)
      .map(entry => entry.args);
  }

  /**
   * Get captured output as formatted strings
   */
  getCapturedOutputAsString(): string[] {
    return this.capturedOutput.map(entry => {
      const args = entry.args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      );
      return `[${entry.method.toUpperCase()}] ${args.join(' ')}`;
    });
  }

  /**
   * Clear all captured output
   */
  clearCapturedOutput(): void {
    this.capturedOutput = [];
  }

  /**
   * Check if any output was captured
   */
  hasCapturedOutput(): boolean {
    return this.capturedOutput.length > 0;
  }

  /**
   * Get count of captured calls by method
   */
  getCaptureCount(method?: 'log' | 'error' | 'warn' | 'info' | 'debug'): number {
    if (!method) {
      return this.capturedOutput.length;
    }
    return this.capturedOutput.filter(entry => entry.method === method).length;
  }

  /**
   * Find specific captured output
   */
  findCapturedOutput(
    method: 'log' | 'error' | 'warn' | 'info' | 'debug',
    searchArgs: any[]
  ): boolean {
    return this.capturedOutput.some(entry => {
      if (entry.method !== method) return false;
      if (entry.args.length !== searchArgs.length) return false;

      return entry.args.every((arg, index) => {
        const searchArg = searchArgs[index];
        if (typeof arg === 'string' && typeof searchArg === 'string') {
          return arg.includes(searchArg);
        }
        return arg === searchArg;
      });
    });
  }
}