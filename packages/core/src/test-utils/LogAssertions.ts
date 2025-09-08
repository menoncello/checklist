import type { MockLogger } from '../utils/MockLogger';
import type { LogContext } from '../utils/logger';

/**
 * LogAssertions - Helper utilities for asserting log messages in tests
 */
export class LogAssertions {
  /**
   * Assert that a specific message was logged at a specific level
   */
  static assertLogged(
    logger: MockLogger,
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    message: string,
    context?: Partial<LogContext>
  ): void {
    const calls = LogAssertions.getCallsForLevel(logger, level);
    const found = calls.find((call) => call.msg === message);

    if (!found) {
      throw new Error(
        `Expected log message "${message}" at level "${level}" not found. ` +
          `Found ${calls.length} ${level} calls: ${calls.map((c) => c.msg).join(', ')}`
      );
    }

    if (context) {
      for (const [key, value] of Object.entries(context)) {
        if (found[key] !== value) {
          throw new Error(
            `Expected log context key "${key}" to be "${value}" but got "${found[key]}"`
          );
        }
      }
    }
  }

  /**
   * Assert that no errors were logged
   */
  static assertNoErrors(logger: MockLogger): void {
    if (logger.errorCalls.length > 0 || logger.fatalCalls.length > 0) {
      const errors = [...logger.errorCalls, ...logger.fatalCalls];
      throw new Error(
        `Expected no errors to be logged, but found ${errors.length}: ` +
          errors.map((e) => e.msg).join(', ')
      );
    }
  }

  /**
   * Assert that a specific error was logged
   */
  static assertErrorLogged(logger: MockLogger, error: Error | string): void {
    const hasError =
      logger.errorCalls.some((call) =>
        typeof error === 'string'
          ? call.msg === error ||
            (call.error as Error | undefined)?.message === error
          : call.error === error ||
            (call.error as Error | undefined)?.message === error.message
      ) ||
      logger.fatalCalls.some((call) =>
        typeof error === 'string'
          ? call.msg === error ||
            (call.error as Error | undefined)?.message === error
          : call.error === error ||
            (call.error as Error | undefined)?.message === error.message
      );

    if (!hasError) {
      const errorMsg = typeof error === 'string' ? error : error.message;
      throw new Error(
        `Expected error "${errorMsg}" to be logged, but it was not found`
      );
    }
  }

  /**
   * Assert that a child logger was created with specific bindings
   */
  static assertChildLoggerCreated(
    logger: MockLogger,
    bindings: Record<string, unknown>
  ): void {
    const found = logger.childCalls.find((call) => {
      for (const [key, value] of Object.entries(bindings)) {
        if (call.bindings[key] !== value) {
          return false;
        }
      }
      return true;
    });

    if (!found) {
      throw new Error(
        `Expected child logger with bindings ${JSON.stringify(bindings)} not found. ` +
          `Found ${logger.childCalls.length} child calls`
      );
    }
  }

  /**
   * Assert the number of log calls at a specific level
   */
  static assertLogCount(
    logger: MockLogger,
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    expectedCount: number
  ): void {
    const calls = LogAssertions.getCallsForLevel(logger, level);
    if (calls.length !== expectedCount) {
      throw new Error(
        `Expected ${expectedCount} ${level} log calls, but found ${calls.length}`
      );
    }
  }

  /**
   * Assert that logger performance is within threshold (for performance tests)
   */
  static async assertLoggerPerformance(
    loggerFactory: () => unknown,
    maxDuration: number = 5
  ): Promise<void> {
    const startTime = performance.now();
    const _logger = loggerFactory();
    const duration = performance.now() - startTime;

    if (duration > maxDuration) {
      throw new Error(
        `Logger creation took ${duration.toFixed(2)}ms, ` +
          `exceeding threshold of ${maxDuration}ms`
      );
    }
  }

  private static getCallsForLevel(
    logger: MockLogger,
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  ): LogContext[] {
    switch (level) {
      case 'debug':
        return logger.debugCalls;
      case 'info':
        return logger.infoCalls;
      case 'warn':
        return logger.warnCalls;
      case 'error':
        return logger.errorCalls;
      case 'fatal':
        return logger.fatalCalls;
    }
  }
}
