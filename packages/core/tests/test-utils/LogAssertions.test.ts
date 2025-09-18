import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { LogAssertions } from './LogAssertions';
import { MockLogger } from './MockLogger';
import type { LogContext } from '../../src/utils/logger';

describe('LogAssertions', () => {
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockLogger = new MockLogger();
  });

  describe('assertLogged', () => {
    test('should pass when message is logged at specified level', () => {
      const context: LogContext = { msg: 'Test message' };
      mockLogger.info(context);

      expect(() => {
        LogAssertions.assertLogged(mockLogger, 'info', 'Test message');
      }).not.toThrow();
    });

    test('should pass when message is logged with matching context', () => {
      const context: LogContext = {
        msg: 'Test message',
        userId: 123,
        action: 'login',
      };
      mockLogger.info(context);

      expect(() => {
        LogAssertions.assertLogged(mockLogger, 'info', 'Test message', {
          userId: 123,
          action: 'login',
        });
      }).not.toThrow();
    });

    test('should pass when message is logged with partial context match', () => {
      const context: LogContext = {
        msg: 'Test message',
        userId: 123,
        action: 'login',
        timestamp: new Date(),
      };
      mockLogger.info(context);

      expect(() => {
        LogAssertions.assertLogged(mockLogger, 'info', 'Test message', {
          userId: 123,
        });
      }).not.toThrow();
    });

    test('should throw when message is not found', () => {
      mockLogger.info({ msg: 'Different message' });

      expect(() => {
        LogAssertions.assertLogged(mockLogger, 'info', 'Test message');
      }).toThrow('Expected log message "Test message" at level "info" not found');
    });

    test('should throw when message is logged at wrong level', () => {
      mockLogger.debug({ msg: 'Test message' });

      expect(() => {
        LogAssertions.assertLogged(mockLogger, 'info', 'Test message');
      }).toThrow('Expected log message "Test message" at level "info" not found');
    });

    test('should throw when context does not match', () => {
      mockLogger.info({
        msg: 'Test message',
        userId: 123,
        action: 'login',
      });

      expect(() => {
        LogAssertions.assertLogged(mockLogger, 'info', 'Test message', {
          userId: 456,
        });
      }).toThrow('Expected log context key "userId" to be "456" but got "123"');
    });

    test('should throw when context key is missing', () => {
      mockLogger.info({
        msg: 'Test message',
        userId: 123,
      });

      expect(() => {
        LogAssertions.assertLogged(mockLogger, 'info', 'Test message', {
          action: 'login',
        });
      }).toThrow('Expected log context key "action" to be "login" but got "undefined"');
    });

    test('should work with all log levels', () => {
      mockLogger.debug({ msg: 'Debug message' });
      mockLogger.info({ msg: 'Info message' });
      mockLogger.warn({ msg: 'Warn message' });
      mockLogger.error({ msg: 'Error message' });
      mockLogger.fatal({ msg: 'Fatal message' });

      expect(() => {
        LogAssertions.assertLogged(mockLogger, 'debug', 'Debug message');
        LogAssertions.assertLogged(mockLogger, 'info', 'Info message');
        LogAssertions.assertLogged(mockLogger, 'warn', 'Warn message');
        LogAssertions.assertLogged(mockLogger, 'error', 'Error message');
        LogAssertions.assertLogged(mockLogger, 'fatal', 'Fatal message');
      }).not.toThrow();
    });

    test('should include found messages in error when assertion fails', () => {
      mockLogger.info({ msg: 'Message 1' });
      mockLogger.info({ msg: 'Message 2' });
      mockLogger.info({ msg: 'Message 3' });

      expect(() => {
        LogAssertions.assertLogged(mockLogger, 'info', 'Missing message');
      }).toThrow('Found 3 info calls: Message 1, Message 2, Message 3');
    });

    test('should handle complex context objects', () => {
      const complexContext: LogContext = {
        msg: 'Complex message',
        data: {
          nested: { value: 42 },
          array: [1, 2, 3],
        },
        error: new Error('Test error'),
        timestamp: new Date('2023-01-01'),
      };

      mockLogger.info(complexContext);

      expect(() => {
        LogAssertions.assertLogged(mockLogger, 'info', 'Complex message', {
          data: complexContext.data,
          error: complexContext.error,
        });
      }).not.toThrow();
    });
  });

  describe('assertNoErrors', () => {
    test('should pass when no errors are logged', () => {
      mockLogger.debug({ msg: 'Debug message' });
      mockLogger.info({ msg: 'Info message' });
      mockLogger.warn({ msg: 'Warn message' });

      expect(() => {
        LogAssertions.assertNoErrors(mockLogger);
      }).not.toThrow();
    });

    test('should throw when error is logged', () => {
      mockLogger.error({ msg: 'Error message' });

      expect(() => {
        LogAssertions.assertNoErrors(mockLogger);
      }).toThrow('Expected no errors to be logged, but found 1: Error message');
    });

    test('should throw when fatal is logged', () => {
      mockLogger.fatal({ msg: 'Fatal message' });

      expect(() => {
        LogAssertions.assertNoErrors(mockLogger);
      }).toThrow('Expected no errors to be logged, but found 1: Fatal message');
    });

    test('should throw when both error and fatal are logged', () => {
      mockLogger.error({ msg: 'Error message' });
      mockLogger.fatal({ msg: 'Fatal message' });

      expect(() => {
        LogAssertions.assertNoErrors(mockLogger);
      }).toThrow('Expected no errors to be logged, but found 2: Error message, Fatal message');
    });

    test('should handle multiple errors', () => {
      mockLogger.error({ msg: 'Error 1' });
      mockLogger.error({ msg: 'Error 2' });
      mockLogger.fatal({ msg: 'Fatal 1' });

      expect(() => {
        LogAssertions.assertNoErrors(mockLogger);
      }).toThrow('Expected no errors to be logged, but found 3: Error 1, Error 2, Fatal 1');
    });
  });

  describe('assertErrorLogged', () => {
    test('should pass when string error message is logged', () => {
      mockLogger.error({ msg: 'Database connection failed' });

      expect(() => {
        LogAssertions.assertErrorLogged(mockLogger, 'Database connection failed');
      }).not.toThrow();
    });

    test('should pass when Error object is logged in error field', () => {
      const error = new Error('Network timeout');
      mockLogger.error({ msg: 'Request failed', error });

      expect(() => {
        LogAssertions.assertErrorLogged(mockLogger, error);
      }).not.toThrow();
    });

    test('should pass when Error object message matches', () => {
      const error = new Error('Network timeout');
      mockLogger.error({ msg: 'Request failed', error });

      expect(() => {
        LogAssertions.assertErrorLogged(mockLogger, 'Network timeout');
      }).not.toThrow();
    });

    test('should pass when error is logged in fatal level', () => {
      const error = new Error('Critical failure');
      mockLogger.fatal({ msg: 'System failure', error });

      expect(() => {
        LogAssertions.assertErrorLogged(mockLogger, error);
      }).not.toThrow();
    });

    test('should pass when string error is in error field', () => {
      mockLogger.error({ msg: 'Operation failed', error: 'Invalid input' });

      expect(() => {
        LogAssertions.assertErrorLogged(mockLogger, 'Operation failed');
      }).not.toThrow();
    });

    test('should throw when error is not found', () => {
      mockLogger.error({ msg: 'Different error' });

      expect(() => {
        LogAssertions.assertErrorLogged(mockLogger, 'Missing error');
      }).toThrow('Expected error "Missing error" to be logged, but it was not found');
    });

    test('should throw when Error object is not found', () => {
      const error = new Error('Missing error');
      mockLogger.error({ msg: 'Different error' });

      expect(() => {
        LogAssertions.assertErrorLogged(mockLogger, error);
      }).toThrow('Expected error "Missing error" to be logged, but it was not found');
    });

    test('should handle error in both error and fatal calls', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      mockLogger.error({ msg: 'First error', error: error1 });
      mockLogger.fatal({ msg: 'Second error', error: error2 });

      expect(() => {
        LogAssertions.assertErrorLogged(mockLogger, error1);
        LogAssertions.assertErrorLogged(mockLogger, error2);
      }).not.toThrow();
    });

    test('should handle Error object with same message but different instance', () => {
      const error1 = new Error('Same message');
      const error2 = new Error('Same message');

      mockLogger.error({ msg: 'Error occurred', error: error1 });

      expect(() => {
        LogAssertions.assertErrorLogged(mockLogger, error2);
      }).not.toThrow();
    });

    test('should handle complex error scenarios', () => {
      const error = new TypeError('Cannot read property of undefined');
      mockLogger.error({
        msg: 'JavaScript error',
        error,
        stack: error.stack,
        context: 'user-service',
      });

      expect(() => {
        LogAssertions.assertErrorLogged(mockLogger, error);
        LogAssertions.assertErrorLogged(mockLogger, 'Cannot read property of undefined');
      }).not.toThrow();
    });
  });

  describe('assertChildLoggerCreated', () => {
    test('should pass when child logger is created with exact bindings', () => {
      const bindings = { module: 'user-service', requestId: 'req-123' };
      mockLogger.child(bindings);

      expect(() => {
        LogAssertions.assertChildLoggerCreated(mockLogger, bindings);
      }).not.toThrow();
    });

    test('should pass when child logger is created with partial bindings match', () => {
      const bindings = { module: 'user-service', requestId: 'req-123', userId: 456 };
      mockLogger.child(bindings);

      expect(() => {
        LogAssertions.assertChildLoggerCreated(mockLogger, { module: 'user-service' });
      }).not.toThrow();
    });

    test('should throw when child logger is not created', () => {
      expect(() => {
        LogAssertions.assertChildLoggerCreated(mockLogger, { module: 'user-service' });
      }).toThrow('Expected child logger with bindings {"module":"user-service"} not found. Found 0 child calls');
    });

    test('should throw when bindings do not match', () => {
      mockLogger.child({ module: 'auth-service', requestId: 'req-123' });

      expect(() => {
        LogAssertions.assertChildLoggerCreated(mockLogger, { module: 'user-service' });
      }).toThrow('Expected child logger with bindings {"module":"user-service"} not found. Found 1 child calls');
    });

    test('should handle multiple child logger calls', () => {
      mockLogger.child({ module: 'auth-service' });
      mockLogger.child({ module: 'user-service' });
      mockLogger.child({ module: 'data-service' });

      expect(() => {
        LogAssertions.assertChildLoggerCreated(mockLogger, { module: 'user-service' });
      }).not.toThrow();
    });

    test('should handle complex bindings', () => {
      const userObj = { id: 456, role: 'admin' };
      const complexBindings = {
        module: 'user-service',
        requestId: 'req-123',
        user: userObj,
        metadata: { version: '1.0.0', environment: 'test' },
      };

      mockLogger.child(complexBindings);

      expect(() => {
        LogAssertions.assertChildLoggerCreated(mockLogger, {
          module: 'user-service',
          user: userObj, // Use same reference
        });
      }).not.toThrow();
    });

    test('should handle empty bindings', () => {
      mockLogger.child({});

      expect(() => {
        LogAssertions.assertChildLoggerCreated(mockLogger, {});
      }).not.toThrow();
    });
  });

  describe('assertLogCount', () => {
    test('should pass when log count matches', () => {
      mockLogger.info({ msg: 'Message 1' });
      mockLogger.info({ msg: 'Message 2' });

      expect(() => {
        LogAssertions.assertLogCount(mockLogger, 'info', 2);
      }).not.toThrow();
    });

    test('should pass when log count is zero', () => {
      expect(() => {
        LogAssertions.assertLogCount(mockLogger, 'info', 0);
      }).not.toThrow();
    });

    test('should throw when log count does not match', () => {
      mockLogger.info({ msg: 'Message 1' });

      expect(() => {
        LogAssertions.assertLogCount(mockLogger, 'info', 2);
      }).toThrow('Expected 2 info log calls, but found 1');
    });

    test('should work with all log levels', () => {
      mockLogger.debug({ msg: 'Debug 1' });
      mockLogger.debug({ msg: 'Debug 2' });
      mockLogger.info({ msg: 'Info 1' });
      mockLogger.warn({ msg: 'Warn 1' });
      mockLogger.warn({ msg: 'Warn 2' });
      mockLogger.warn({ msg: 'Warn 3' });
      mockLogger.error({ msg: 'Error 1' });
      mockLogger.fatal({ msg: 'Fatal 1' });

      expect(() => {
        LogAssertions.assertLogCount(mockLogger, 'debug', 2);
        LogAssertions.assertLogCount(mockLogger, 'info', 1);
        LogAssertions.assertLogCount(mockLogger, 'warn', 3);
        LogAssertions.assertLogCount(mockLogger, 'error', 1);
        LogAssertions.assertLogCount(mockLogger, 'fatal', 1);
      }).not.toThrow();
    });

    test('should handle large log counts', () => {
      for (let i = 0; i < 100; i++) {
        mockLogger.info({ msg: `Message ${i}` });
      }

      expect(() => {
        LogAssertions.assertLogCount(mockLogger, 'info', 100);
      }).not.toThrow();
    });
  });

  describe('assertLoggerPerformance', () => {
    test('should pass when logger creation is fast', async () => {
      const fastFactory = () => new MockLogger();

      await expect(async () => {
        await LogAssertions.assertLoggerPerformance(fastFactory, 10);
      }).not.toThrow();
    });

    test('should pass with default threshold', async () => {
      const fastFactory = () => new MockLogger();

      await expect(async () => {
        await LogAssertions.assertLoggerPerformance(fastFactory);
      }).not.toThrow();
    });

    test('should throw when logger creation is slow', async () => {
      const slowFactory = () => {
        // Simulate slow logger creation
        const start = performance.now();
        while (performance.now() - start < 10) {
          // Busy wait to create delay
        }
        return new MockLogger();
      };

      try {
        await LogAssertions.assertLoggerPerformance(slowFactory, 5);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('exceeding threshold of 5ms');
      }
    });

    test('should handle factory that returns unknown type', async () => {
      const factory = () => ({ type: 'custom-logger' });

      await expect(async () => {
        await LogAssertions.assertLoggerPerformance(factory, 10);
      }).not.toThrow();
    });

    test('should handle factory that throws', async () => {
      const throwingFactory = () => {
        throw new Error('Factory error');
      };

      // Should still measure performance even if factory throws
      try {
        await LogAssertions.assertLoggerPerformance(throwingFactory, 10);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toBe('Factory error');
      }
    });

    test('should include actual duration in error message', async () => {
      const slowFactory = () => {
        const start = performance.now();
        while (performance.now() - start < 8) {
          // Busy wait
        }
        return new MockLogger();
      };

      try {
        await LogAssertions.assertLoggerPerformance(slowFactory, 5);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toMatch(/Logger creation took \d+\.\d{2}ms/);
        expect((error as Error).message).toContain('exceeding threshold of 5ms');
      }
    });
  });

  describe('getCallsForLevel (private method behavior)', () => {
    test('should return correct calls for each level', () => {
      mockLogger.debug({ msg: 'Debug message' });
      mockLogger.info({ msg: 'Info message' });
      mockLogger.warn({ msg: 'Warn message' });
      mockLogger.error({ msg: 'Error message' });
      mockLogger.fatal({ msg: 'Fatal message' });

      // Test through public methods that use getCallsForLevel
      expect(() => {
        LogAssertions.assertLogCount(mockLogger, 'debug', 1);
        LogAssertions.assertLogCount(mockLogger, 'info', 1);
        LogAssertions.assertLogCount(mockLogger, 'warn', 1);
        LogAssertions.assertLogCount(mockLogger, 'error', 1);
        LogAssertions.assertLogCount(mockLogger, 'fatal', 1);
      }).not.toThrow();
    });
  });

  describe('integration tests', () => {
    test('should work with complex logging scenarios', () => {
      // Simulate a service operation with logging
      const serviceOperation = (logger: MockLogger) => {
        logger.info({ msg: 'Operation started', operationId: 'op-123' });

        const childLogger = logger.child({ module: 'database' });
        childLogger.debug({ msg: 'Connecting to database' });
        childLogger.info({ msg: 'Database connected', connectionId: 'conn-456' });

        logger.warn({ msg: 'Performance threshold exceeded', duration: 150 });

        try {
          throw new Error('Simulated error');
        } catch (error) {
          logger.error({ msg: 'Operation failed', error, operationId: 'op-123' });
        }

        logger.info({ msg: 'Operation completed', operationId: 'op-123' });
      };

      serviceOperation(mockLogger);

      // Comprehensive assertions
      expect(() => {
        LogAssertions.assertLogged(mockLogger, 'info', 'Operation started', { operationId: 'op-123' });
        LogAssertions.assertLogged(mockLogger, 'warn', 'Performance threshold exceeded', { duration: 150 });
        LogAssertions.assertLogged(mockLogger, 'error', 'Operation failed', { operationId: 'op-123' });
        LogAssertions.assertLogged(mockLogger, 'info', 'Operation completed', { operationId: 'op-123' });

        LogAssertions.assertChildLoggerCreated(mockLogger, { module: 'database' });
        LogAssertions.assertErrorLogged(mockLogger, 'Simulated error');

        LogAssertions.assertLogCount(mockLogger, 'info', 2);
        LogAssertions.assertLogCount(mockLogger, 'warn', 1);
        LogAssertions.assertLogCount(mockLogger, 'error', 1);
        LogAssertions.assertLogCount(mockLogger, 'debug', 0); // Parent logger has no debug calls
      }).not.toThrow();
    });

    test('should handle edge cases in combination', () => {
      // Test with empty messages, null values, etc.
      mockLogger.info({ msg: '' });
      mockLogger.error({ msg: 'Error with null', data: null, undefined: undefined });

      expect(() => {
        LogAssertions.assertLogged(mockLogger, 'info', '');
        LogAssertions.assertLogged(mockLogger, 'error', 'Error with null', { data: null });
        LogAssertions.assertLogCount(mockLogger, 'info', 1);
        LogAssertions.assertLogCount(mockLogger, 'error', 1);
      }).not.toThrow();
    });
  });

  describe('error handling and edge cases', () => {
    test('should handle assertion failures gracefully', () => {
      mockLogger.info({ msg: 'Test message' });
      mockLogger.error({ msg: 'Error message' });

      const errors: Error[] = [];

      // Collect all assertion errors
      try {
        LogAssertions.assertLogged(mockLogger, 'warn', 'Test message');
      } catch (e) {
        errors.push(e as Error);
      }

      try {
        LogAssertions.assertNoErrors(mockLogger);
      } catch (e) {
        errors.push(e as Error);
      }

      try {
        LogAssertions.assertErrorLogged(mockLogger, 'Missing error');
      } catch (e) {
        errors.push(e as Error);
      }

      expect(errors).toHaveLength(3);
      expect(errors.every(e => e instanceof Error)).toBe(true);
    });

    test('should handle unusual context values', () => {
      const unusualContext: LogContext = {
        msg: 'Test message',
        circular: {} as unknown,
        function: () => {},
        symbol: Symbol('test'),
        bigint: BigInt(123),
      };
      (unusualContext.circular as { self?: unknown }).self = unusualContext.circular;

      mockLogger.info(unusualContext);

      expect(() => {
        LogAssertions.assertLogged(mockLogger, 'info', 'Test message', {
          function: unusualContext.function,
          symbol: unusualContext.symbol,
          bigint: unusualContext.bigint,
        });
      }).not.toThrow();
    });
  });
});