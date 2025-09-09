import type { ChildLoggerOptions } from 'pino';
import type { Logger, LogContext } from './logger';

/**
 * MockLogger - Test double for Logger interface
 * Captures all log calls for assertion in tests
 */
export class MockLogger implements Logger {
  public debugCalls: LogContext[] = [];
  public infoCalls: LogContext[] = [];
  public warnCalls: LogContext[] = [];
  public errorCalls: LogContext[] = [];
  public fatalCalls: LogContext[] = [];
  public childCalls: Array<{
    bindings: Record<string, unknown>;
    options?: ChildLoggerOptions;
  }> = [];

  debug(context: LogContext): void {
    this.debugCalls.push(context);
  }

  info(context: LogContext): void {
    this.infoCalls.push(context);
  }

  warn(context: LogContext): void {
    this.warnCalls.push(context);
  }

  error(context: LogContext): void {
    this.errorCalls.push(context);
  }

  fatal(context: LogContext): void {
    this.fatalCalls.push(context);
  }

  child(
    _bindings: Record<string, unknown>,
    _options?: ChildLoggerOptions
  ): Logger {
    this.childCalls.push({ bindings: _bindings, options: _options });
    // Return a new MockLogger instance for chaining
    const childLogger = new MockLogger();
    // Copy parent calls to maintain hierarchy
    childLogger.debugCalls = [...this.debugCalls];
    childLogger.infoCalls = [...this.infoCalls];
    childLogger.warnCalls = [...this.warnCalls];
    childLogger.errorCalls = [...this.errorCalls];
    childLogger.fatalCalls = [...this.fatalCalls];
    return childLogger;
  }

  // Helper methods for testing
  clear(): void {
    this.debugCalls = [];
    this.infoCalls = [];
    this.warnCalls = [];
    this.errorCalls = [];
    this.fatalCalls = [];
    this.childCalls = [];
  }

  getAllCalls(): LogContext[] {
    return [
      ...this.debugCalls,
      ...this.infoCalls,
      ...this.warnCalls,
      ...this.errorCalls,
      ...this.fatalCalls,
    ];
  }

  hasLoggedMessage(
    message: string,
    level?: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  ): boolean {
    const calls = level ? this.getCallsForLevel(level) : this.getAllCalls();
    return calls.some((call) => call.msg === message);
  }

  hasLoggedError(error: Error | unknown): boolean {
    return (
      this.errorCalls.some((call) => call.error === error) ||
      this.fatalCalls.some((call) => call.error === error)
    );
  }

  private getCallsForLevel(
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  ): LogContext[] {
    switch (level) {
      case 'debug':
        return this.debugCalls;
      case 'info':
        return this.infoCalls;
      case 'warn':
        return this.warnCalls;
      case 'error':
        return this.errorCalls;
      case 'fatal':
        return this.fatalCalls;
    }
  }
}

/**
 * InMemoryLogger - Logger implementation that stores logs in memory
 * Useful for unit tests that need to verify log output without file I/O
 */
export class InMemoryLogger implements Logger {
  private logs: Array<{ level: string; context: LogContext; timestamp: Date }> =
    [];

  debug(context: LogContext): void {
    this.logs.push({ level: 'debug', context, timestamp: new Date() });
  }

  info(context: LogContext): void {
    this.logs.push({ level: 'info', context, timestamp: new Date() });
  }

  warn(context: LogContext): void {
    this.logs.push({ level: 'warn', context, timestamp: new Date() });
  }

  error(context: LogContext): void {
    this.logs.push({ level: 'error', context, timestamp: new Date() });
  }

  fatal(context: LogContext): void {
    this.logs.push({ level: 'fatal', context, timestamp: new Date() });
  }

  child(
    _bindings: Record<string, unknown>,
    _options?: ChildLoggerOptions
  ): Logger {
    const childLogger = new InMemoryLogger();
    // Inherit parent logs
    childLogger.logs = [...this.logs];
    return childLogger;
  }

  // Helper methods
  getLogs(): Array<{ level: string; context: LogContext; timestamp: Date }> {
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
  }
}
