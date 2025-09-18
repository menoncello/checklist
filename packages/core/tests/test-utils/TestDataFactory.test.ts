import { describe, test, expect, mock } from 'bun:test';
import { TestDataFactory } from './TestDataFactory';
import { MockLogger, InMemoryLogger } from './MockLogger';
import type { Logger, LogContext } from '../../src/utils/logger';

describe('TestDataFactory', () => {
  describe('createMockLogger', () => {
    test('should create a MockLogger instance', () => {
      const mockLogger = TestDataFactory.createMockLogger();

      expect(mockLogger).toBeInstanceOf(MockLogger);
      expect(mockLogger.debugCalls).toEqual([]);
      expect(mockLogger.infoCalls).toEqual([]);
      expect(mockLogger.warnCalls).toEqual([]);
      expect(mockLogger.errorCalls).toEqual([]);
      expect(mockLogger.fatalCalls).toEqual([]);
      expect(mockLogger.childCalls).toEqual([]);
    });

    test('should create independent mock logger instances', () => {
      const mockLogger1 = TestDataFactory.createMockLogger();
      const mockLogger2 = TestDataFactory.createMockLogger();

      expect(mockLogger1).not.toBe(mockLogger2);

      mockLogger1.info({ msg: 'Test message' });
      expect(mockLogger1.infoCalls).toHaveLength(1);
      expect(mockLogger2.infoCalls).toHaveLength(0);
    });

    test('should create mock logger with all expected methods', () => {
      const mockLogger = TestDataFactory.createMockLogger();

      expect(typeof mockLogger.debug).toBe('function');
      expect(typeof mockLogger.info).toBe('function');
      expect(typeof mockLogger.warn).toBe('function');
      expect(typeof mockLogger.error).toBe('function');
      expect(typeof mockLogger.fatal).toBe('function');
      expect(typeof mockLogger.child).toBe('function');
      expect(typeof mockLogger.clear).toBe('function');
      expect(typeof mockLogger.getAllCalls).toBe('function');
      expect(typeof mockLogger.hasLoggedMessage).toBe('function');
      expect(typeof mockLogger.hasLoggedError).toBe('function');
    });
  });

  describe('createInMemoryLogger', () => {
    test('should create an InMemoryLogger instance', () => {
      const inMemoryLogger = TestDataFactory.createInMemoryLogger();

      expect(inMemoryLogger).toBeInstanceOf(InMemoryLogger);
      expect(inMemoryLogger.getLogs()).toEqual([]);
    });

    test('should create independent in-memory logger instances', () => {
      const logger1 = TestDataFactory.createInMemoryLogger();
      const logger2 = TestDataFactory.createInMemoryLogger();

      expect(logger1).not.toBe(logger2);

      logger1.info({ msg: 'Test message' });
      expect(logger1.getLogs()).toHaveLength(1);
      expect(logger2.getLogs()).toHaveLength(0);
    });

    test('should create in-memory logger with all expected methods', () => {
      const inMemoryLogger = TestDataFactory.createInMemoryLogger();

      expect(typeof inMemoryLogger.debug).toBe('function');
      expect(typeof inMemoryLogger.info).toBe('function');
      expect(typeof inMemoryLogger.warn).toBe('function');
      expect(typeof inMemoryLogger.error).toBe('function');
      expect(typeof inMemoryLogger.fatal).toBe('function');
      expect(typeof inMemoryLogger.child).toBe('function');
      expect(typeof inMemoryLogger.getLogs).toBe('function');
      expect(typeof inMemoryLogger.clear).toBe('function');
    });

    test('should store logs correctly in in-memory logger', () => {
      const inMemoryLogger = TestDataFactory.createInMemoryLogger();
      const context: LogContext = { msg: 'Test log message', data: { value: 42 } };

      inMemoryLogger.info(context);

      const logs = inMemoryLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].context).toEqual(context);
      expect(logs[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('createSilentLogger', () => {
    test('should create a silent logger instance', () => {
      const silentLogger = TestDataFactory.createSilentLogger();

      expect(silentLogger).toBeDefined();
      expect(typeof silentLogger.debug).toBe('function');
      expect(typeof silentLogger.info).toBe('function');
      expect(typeof silentLogger.warn).toBe('function');
      expect(typeof silentLogger.error).toBe('function');
      expect(typeof silentLogger.fatal).toBe('function');
      expect(typeof silentLogger.child).toBe('function');
    });

    test('should create independent silent logger instances', () => {
      const logger1 = TestDataFactory.createSilentLogger();
      const logger2 = TestDataFactory.createSilentLogger();

      expect(logger1).not.toBe(logger2);
    });

    test('should not throw when logging to silent logger', () => {
      const silentLogger = TestDataFactory.createSilentLogger();
      const context: LogContext = { msg: 'Test message', error: new Error('Test error') };

      expect(() => {
        silentLogger.debug(context);
        silentLogger.info(context);
        silentLogger.warn(context);
        silentLogger.error(context);
        silentLogger.fatal(context);
      }).not.toThrow();
    });

    test('should create child loggers that are also silent', () => {
      const silentLogger = TestDataFactory.createSilentLogger();
      const childLogger = silentLogger.child({ module: 'test' });

      expect(childLogger).toBeDefined();
      expect(typeof childLogger.debug).toBe('function');
      expect(typeof childLogger.info).toBe('function');
      expect(typeof childLogger.warn).toBe('function');
      expect(typeof childLogger.error).toBe('function');
      expect(typeof childLogger.fatal).toBe('function');
      expect(typeof childLogger.child).toBe('function');

      expect(() => {
        childLogger.info({ msg: 'Child logger test' });
      }).not.toThrow();
    });

    test('should handle complex log contexts without errors', () => {
      const silentLogger = TestDataFactory.createSilentLogger();
      const complexContext: LogContext = {
        msg: 'Complex message',
        error: new Error('Test error'),
        data: {
          nested: { value: 42 },
          array: [1, 2, 3],
          nullValue: null,
          undefinedValue: undefined,
        },
        timestamp: new Date(),
        metadata: { key: 'value' },
      };

      expect(() => {
        silentLogger.info(complexContext);
      }).not.toThrow();
    });
  });

  describe('createCustomLogger', () => {
    test('should create a custom logger with provided handlers', () => {
      const debugSpy = mock(() => {});
      const infoSpy = mock(() => {});
      const warnSpy = mock(() => {});

      const customLogger = TestDataFactory.createCustomLogger({
        debug: debugSpy,
        info: infoSpy,
        warn: warnSpy,
      });

      expect(customLogger).toBeDefined();
      expect(typeof customLogger.debug).toBe('function');
      expect(typeof customLogger.info).toBe('function');
      expect(typeof customLogger.warn).toBe('function');
      expect(typeof customLogger.error).toBe('function');
      expect(typeof customLogger.fatal).toBe('function');
      expect(typeof customLogger.child).toBe('function');
    });

    test('should use provided handlers when logging', () => {
      const debugSpy = mock(() => {});
      const infoSpy = mock(() => {});
      const warnSpy = mock(() => {});

      const customLogger = TestDataFactory.createCustomLogger({
        debug: debugSpy,
        info: infoSpy,
        warn: warnSpy,
      });

      const debugContext: LogContext = { msg: 'Debug message' };
      const infoContext: LogContext = { msg: 'Info message' };
      const warnContext: LogContext = { msg: 'Warn message' };

      customLogger.debug(debugContext);
      customLogger.info(infoContext);
      customLogger.warn(warnContext);

      expect(debugSpy).toHaveBeenCalledWith(debugContext);
      expect(infoSpy).toHaveBeenCalledWith(infoContext);
      expect(warnSpy).toHaveBeenCalledWith(warnContext);
    });

    test('should use silent handlers for non-provided methods', () => {
      const infoSpy = mock(() => {});

      const customLogger = TestDataFactory.createCustomLogger({
        info: infoSpy,
      });

      const context: LogContext = { msg: 'Test message' };

      // Should not throw for methods without custom handlers
      expect(() => {
        customLogger.debug(context);
        customLogger.warn(context);
        customLogger.error(context);
        customLogger.fatal(context);
      }).not.toThrow();

      // Should use provided handler
      customLogger.info(context);
      expect(infoSpy).toHaveBeenCalledWith(context);
    });

    test('should create child loggers when child handler is provided', () => {
      const childSpy = mock(() => {});
      const childLogger = TestDataFactory.createSilentLogger();
      (childSpy as unknown as ReturnType<typeof mock>).mockReturnValue(childLogger);

      const customLogger = TestDataFactory.createCustomLogger({
        child: childSpy as unknown as Logger['child'],
      });

      const bindings = { module: 'test' };
      const result = customLogger.child(bindings);

      expect(childSpy).toHaveBeenCalledWith(bindings);
      expect(result).toBe(childLogger);
    });

    test('should create silent child loggers when no child handler is provided', () => {
      const customLogger = TestDataFactory.createCustomLogger({
        info: mock(() => {}),
      });

      const childLogger = customLogger.child({ module: 'test' });

      expect(childLogger).toBeDefined();
      expect(typeof childLogger.debug).toBe('function');
      expect(typeof childLogger.info).toBe('function');
      expect(typeof childLogger.warn).toBe('function');
      expect(typeof childLogger.error).toBe('function');
      expect(typeof childLogger.fatal).toBe('function');
      expect(typeof childLogger.child).toBe('function');

      // Should not throw when using child logger
      expect(() => {
        childLogger.info({ msg: 'Child test' });
      }).not.toThrow();
    });

    test('should handle complex custom handlers', () => {
      const logBuffer: Array<{ level: string; context: LogContext }> = [];

      const createHandler = (level: string) => (context: LogContext) => {
        logBuffer.push({ level, context });
      };

      const customLogger = TestDataFactory.createCustomLogger({
        debug: createHandler('debug'),
        info: createHandler('info'),
        warn: createHandler('warn'),
        error: createHandler('error'),
        fatal: createHandler('fatal'),
      });

      const contexts = [
        { msg: 'Debug message', level: 'debug' },
        { msg: 'Info message', level: 'info' },
        { msg: 'Warn message', level: 'warn' },
        { msg: 'Error message', level: 'error' },
        { msg: 'Fatal message', level: 'fatal' },
      ];

      customLogger.debug(contexts[0]);
      customLogger.info(contexts[1]);
      customLogger.warn(contexts[2]);
      customLogger.error(contexts[3]);
      customLogger.fatal(contexts[4]);

      expect(logBuffer).toHaveLength(5);
      expect(logBuffer[0]).toEqual({ level: 'debug', context: contexts[0] });
      expect(logBuffer[1]).toEqual({ level: 'info', context: contexts[1] });
      expect(logBuffer[2]).toEqual({ level: 'warn', context: contexts[2] });
      expect(logBuffer[3]).toEqual({ level: 'error', context: contexts[3] });
      expect(logBuffer[4]).toEqual({ level: 'fatal', context: contexts[4] });
    });

    test('should create independent custom logger instances', () => {
      const spy1 = mock(() => {});
      const spy2 = mock(() => {});

      const logger1 = TestDataFactory.createCustomLogger({ info: spy1 });
      const logger2 = TestDataFactory.createCustomLogger({ info: spy2 });

      expect(logger1).not.toBe(logger2);

      const context: LogContext = { msg: 'Test' };
      logger1.info(context);

      expect(spy1).toHaveBeenCalledWith(context);
      expect(spy2).not.toHaveBeenCalled();
    });
  });

  describe('integration tests', () => {
    test('should create different types of loggers that work together', () => {
      const mockLogger = TestDataFactory.createMockLogger();
      const inMemoryLogger = TestDataFactory.createInMemoryLogger();
      const silentLogger = TestDataFactory.createSilentLogger();
      const customLogger = TestDataFactory.createCustomLogger({
        info: mock(() => {}),
      });

      const context: LogContext = { msg: 'Integration test' };

      expect(() => {
        mockLogger.info(context);
        inMemoryLogger.info(context);
        silentLogger.info(context);
        customLogger.info(context);
      }).not.toThrow();

      expect(mockLogger.infoCalls).toHaveLength(1);
      expect(inMemoryLogger.getLogs()).toHaveLength(1);
    });

    test('should handle error contexts across all logger types', () => {
      const error = new Error('Test error');
      const context: LogContext = {
        msg: 'Error occurred',
        error,
        stack: error.stack,
        code: 'TEST_ERROR',
      };

      const mockLogger = TestDataFactory.createMockLogger();
      const inMemoryLogger = TestDataFactory.createInMemoryLogger();
      const silentLogger = TestDataFactory.createSilentLogger();
      const errorSpy = mock(() => {});
      const customLogger = TestDataFactory.createCustomLogger({
        error: errorSpy,
      });

      expect(() => {
        mockLogger.error(context);
        inMemoryLogger.error(context);
        silentLogger.error(context);
        customLogger.error(context);
      }).not.toThrow();

      expect(mockLogger.errorCalls).toHaveLength(1);
      expect(mockLogger.errorCalls[0]).toEqual(context);

      const logs = inMemoryLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('error');
      expect(logs[0].context).toEqual(context);

      expect(errorSpy).toHaveBeenCalledWith(context);
    });

    test('should handle child logger creation across different types', () => {
      const mockLogger = TestDataFactory.createMockLogger();
      const inMemoryLogger = TestDataFactory.createInMemoryLogger();
      const silentLogger = TestDataFactory.createSilentLogger();
      const customLogger = TestDataFactory.createCustomLogger({});

      const bindings = { module: 'test-module', requestId: 'req-123' };

      const mockChild = mockLogger.child(bindings);
      const inMemoryChild = inMemoryLogger.child(bindings);
      const silentChild = silentLogger.child(bindings);
      const customChild = customLogger.child(bindings);

      expect(mockChild).toBeInstanceOf(MockLogger);
      expect(inMemoryChild).toBeInstanceOf(InMemoryLogger);
      expect(silentChild).toBeDefined();
      expect(customChild).toBeDefined();

      const context: LogContext = { msg: 'Child logger test' };

      expect(() => {
        mockChild.info(context);
        inMemoryChild.info(context);
        silentChild.info(context);
        customChild.info(context);
      }).not.toThrow();
    });
  });

  describe('performance tests', () => {
    test('should create loggers efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        TestDataFactory.createMockLogger();
        TestDataFactory.createInMemoryLogger();
        TestDataFactory.createSilentLogger();
        TestDataFactory.createCustomLogger({});
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100); // Should be very fast
    });

    test('should handle rapid logging with silent logger', () => {
      const silentLogger = TestDataFactory.createSilentLogger();
      const context: LogContext = { msg: 'Performance test' };

      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        silentLogger.info(context);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(50); // Should be very fast for silent logger
    });
  });

  describe('edge cases', () => {
    test('should handle empty custom logger configuration', () => {
      const customLogger = TestDataFactory.createCustomLogger({});

      expect(customLogger).toBeDefined();

      const context: LogContext = { msg: 'Empty config test' };

      expect(() => {
        customLogger.debug(context);
        customLogger.info(context);
        customLogger.warn(context);
        customLogger.error(context);
        customLogger.fatal(context);
      }).not.toThrow();
    });

    test('should handle null and undefined in log contexts', () => {
      const mockLogger = TestDataFactory.createMockLogger();
      const inMemoryLogger = TestDataFactory.createInMemoryLogger();
      const silentLogger = TestDataFactory.createSilentLogger();

      const context: LogContext = {
        msg: 'Null and undefined test',
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        zeroValue: 0,
        falseValue: false,
      };

      expect(() => {
        mockLogger.info(context);
        inMemoryLogger.info(context);
        silentLogger.info(context);
      }).not.toThrow();

      expect(mockLogger.infoCalls[0]).toEqual(context);
      expect(inMemoryLogger.getLogs()[0].context).toEqual(context);
    });

    test('should handle circular references in custom logger handlers', () => {
      const circularObj: any = { msg: 'Circular reference test' };
      circularObj.self = circularObj;

      const customLogger = TestDataFactory.createCustomLogger({
        info: (context) => {
          // Handler that might try to serialize the context
          expect(context).toBeDefined();
        },
      });

      expect(() => {
        customLogger.info(circularObj);
      }).not.toThrow();
    });
  });
});