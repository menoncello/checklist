/**
 * Test Console Helper
 * Simple console helper for CLI tests
 */

import { SimpleConsoleCapture } from './SimpleConsoleCapture';

export class TestConsoleHelper {
  private capture: SimpleConsoleCapture;

  constructor() {
    this.capture = new SimpleConsoleCapture();
  }

  /**
   * Start capturing console output
   */
  startCapture(): void {
    this.capture.startCapture();
  }

  /**
   * Stop capturing console output
   */
  stopCapture(): void {
    this.capture.stopCapture();
  }

  /**
   * Clear captured output
   */
  clearCapture(): void {
    this.capture.clear();
  }

  /**
   * Check if a specific console call was made
   */
  wasCalled(method: 'log' | 'error' | 'warn' | 'info' | 'debug', ...args: any[]): boolean {
    return this.capture.wasCalled(method, ...args);
  }

  /**
   * Get all captured calls for a method
   */
  getCalls(method: 'log' | 'error' | 'warn' | 'info' | 'debug'): any[][] {
    return this.capture.getCalls(method);
  }

  /**
   * Get all captured calls
   */
  getAllCalls(): Array<{ method: string; args: any[] }> {
    return this.capture.getAllCalls();
  }

  /**
   * Get call count
   */
  getCallCount(method?: 'log' | 'error' | 'warn' | 'info' | 'debug'): number {
    return this.capture.getCallCount(method);
  }

  /**
   * Check if capture is active
   */
  isCapturing(): boolean {
    return this.capture.isActive();
  }
}

// Create a singleton instance for tests
export const testConsole = new TestConsoleHelper();