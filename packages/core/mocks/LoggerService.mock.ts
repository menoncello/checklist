import type {
  ILogger,
  LogContext,
  ChildLoggerOptions,
} from '../src/interfaces/ILogger';

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  context: LogContext;
  timestamp: Date;
  bindings?: Record<string, unknown>;
}

export class MockLoggerService implements ILogger {
  public logs: LogEntry[] = [];
  public childLoggers: MockLoggerService[] = [];
  private bindings: Record<string, unknown> = {};

  constructor(bindings: Record<string, unknown> = {}) {
    this.bindings = bindings;
  }

  debug(context: LogContext): void {
    this.logs.push({
      level: 'debug',
      context: { ...this.bindings, ...context },
      timestamp: new Date(),
      bindings: this.bindings,
    });
  }

  info(context: LogContext): void {
    this.logs.push({
      level: 'info',
      context: { ...this.bindings, ...context },
      timestamp: new Date(),
      bindings: this.bindings,
    });
  }

  warn(context: LogContext): void {
    this.logs.push({
      level: 'warn',
      context: { ...this.bindings, ...context },
      timestamp: new Date(),
      bindings: this.bindings,
    });
  }

  error(context: LogContext): void {
    this.logs.push({
      level: 'error',
      context: { ...this.bindings, ...context },
      timestamp: new Date(),
      bindings: this.bindings,
    });
  }

  fatal(context: LogContext): void {
    this.logs.push({
      level: 'fatal',
      context: { ...this.bindings, ...context },
      timestamp: new Date(),
      bindings: this.bindings,
    });
  }

  child(
    bindings: Record<string, unknown>,
    _options?: ChildLoggerOptions
  ): ILogger {
    const childLogger = new MockLoggerService({
      ...this.bindings,
      ...bindings,
    });
    this.childLoggers.push(childLogger);
    return childLogger;
  }

  // Spy methods for testing
  clear(): void {
    this.logs = [];
    this.childLoggers = [];
  }

  getLogsByLevel(level: LogEntry['level']): LogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  hasLoggedMessage(msg: string): boolean {
    return this.logs.some((log) => log.context.msg === msg);
  }

  hasLoggedError(error: string | Error): boolean {
    const errorMessage = error instanceof Error ? error.message : error;
    return this.logs.some(
      (log) =>
        log.level === 'error' &&
        (log.context.error === errorMessage || log.context.msg === errorMessage)
    );
  }

  getLastLog(): LogEntry | undefined {
    return this.logs[this.logs.length - 1];
  }

  getLogCount(): number {
    return this.logs.length;
  }

  getChildLoggerCount(): number {
    return this.childLoggers.length;
  }

  // Assertion helpers
  assertLogged(level: LogEntry['level'], msg: string): void {
    const found = this.logs.some(
      (log) => log.level === level && log.context.msg === msg
    );
    if (!found) {
      throw new Error(`Expected log not found: [${level}] ${msg}`);
    }
  }

  assertNotLogged(level: LogEntry['level'], msg: string): void {
    const found = this.logs.some(
      (log) => log.level === level && log.context.msg === msg
    );
    if (found) {
      throw new Error(`Unexpected log found: [${level}] ${msg}`);
    }
  }

  assertLogCount(expectedCount: number): void {
    if (this.logs.length !== expectedCount) {
      throw new Error(
        `Expected ${expectedCount} logs, but found ${this.logs.length}`
      );
    }
  }
}
