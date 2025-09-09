import { MockLogger, InMemoryLogger } from './MockLogger';
import type { Logger } from '../../src/utils/logger';

/**
 * TestDataFactory - Factory for creating test data and mocks
 */
export class TestDataFactory {
  /**
   * Create a mock logger with jest-style spy functions
   */
  static createMockLogger(): MockLogger {
    return new MockLogger();
  }

  /**
   * Create an in-memory logger for integration tests
   */
  static createInMemoryLogger(): InMemoryLogger {
    return new InMemoryLogger();
  }

  /**
   * Create a silent logger that does nothing (for performance tests)
   */
  static createSilentLogger(): Logger {
    return {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      fatal: () => {},
      child: () => TestDataFactory.createSilentLogger(),
    };
  }

  /**
   * Create a logger with custom behavior
   */
  static createCustomLogger(handlers: Partial<Logger>): Logger {
    return {
      debug: handlers.debug ?? (() => {}),
      info: handlers.info ?? (() => {}),
      warn: handlers.warn ?? (() => {}),
      error: handlers.error ?? (() => {}),
      fatal: handlers.fatal ?? (() => {}),
      child: handlers.child ?? (() => TestDataFactory.createSilentLogger()),
    };
  }
}
