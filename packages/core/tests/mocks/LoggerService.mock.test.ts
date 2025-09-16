import { test, expect, beforeEach, afterEach, describe } from 'bun:test';
import { MockLoggerService, LogEntry } from './LoggerService.mock';
import type { LogContext } from '../../src/interfaces/ILogger';

describe('MockLoggerService', () => {
  let mockLogger: MockLoggerService;

  beforeEach(() => {
    mockLogger = new MockLoggerService();
  });

  afterEach(() => {
    mockLogger.clear();
  });

  describe('constructor', () => {
    test('should initialize with empty logs and no bindings', () => {
      const logger = new MockLoggerService();

      expect(logger.logs).toEqual([]);
      expect(logger.childLoggers).toEqual([]);
      expect(logger.getLogCount()).toBe(0);
      expect(logger.getChildLoggerCount()).toBe(0);
    });

    test('should initialize with provided bindings', () => {
      const bindings = { service: 'test-service', version: '1.0.0' };
      const logger = new MockLoggerService(bindings);

      logger.info({ msg: 'test message' });

      const lastLog = logger.getLastLog();
      expect(lastLog?.bindings).toEqual(bindings);
      expect(lastLog?.context).toMatchObject(bindings);
    });
  });

  describe('logging methods', () => {
    test('should log debug messages', () => {
      const context: LogContext = { msg: 'Debug message', data: { test: true } };

      mockLogger.debug(context);

      expect(mockLogger.getLogCount()).toBe(1);
      const log = mockLogger.getLastLog();
      expect(log?.level).toBe('debug');
      expect(log?.context).toEqual(context);
      expect(log?.timestamp).toBeInstanceOf(Date);
    });

    test('should log info messages', () => {
      const context: LogContext = { msg: 'Info message', userId: 123 };

      mockLogger.info(context);

      expect(mockLogger.getLogCount()).toBe(1);
      const log = mockLogger.getLastLog();
      expect(log?.level).toBe('info');
      expect(log?.context).toEqual(context);
    });

    test('should log warn messages', () => {
      const context: LogContext = { msg: 'Warning message', error: 'something went wrong' };

      mockLogger.warn(context);

      expect(mockLogger.getLogCount()).toBe(1);
      const log = mockLogger.getLastLog();
      expect(log?.level).toBe('warn');
      expect(log?.context).toEqual(context);
    });

    test('should log error messages', () => {
      const context: LogContext = { msg: 'Error message', error: new Error('Test error') };

      mockLogger.error(context);

      expect(mockLogger.getLogCount()).toBe(1);
      const log = mockLogger.getLastLog();
      expect(log?.level).toBe('error');
      expect(log?.context).toEqual(context);
    });

    test('should log fatal messages', () => {
      const context: LogContext = { msg: 'Fatal error', critical: true };

      mockLogger.fatal(context);

      expect(mockLogger.getLogCount()).toBe(1);
      const log = mockLogger.getLastLog();
      expect(log?.level).toBe('fatal');
      expect(log?.context).toEqual(context);
    });

    test('should maintain log order', () => {
      mockLogger.debug({ msg: 'First' });
      mockLogger.info({ msg: 'Second' });
      mockLogger.warn({ msg: 'Third' });
      mockLogger.error({ msg: 'Fourth' });
      mockLogger.fatal({ msg: 'Fifth' });

      expect(mockLogger.getLogCount()).toBe(5);
      expect(mockLogger.logs[0].context.msg).toBe('First');
      expect(mockLogger.logs[1].context.msg).toBe('Second');
      expect(mockLogger.logs[2].context.msg).toBe('Third');
      expect(mockLogger.logs[3].context.msg).toBe('Fourth');
      expect(mockLogger.logs[4].context.msg).toBe('Fifth');
    });

    test('should merge bindings with context', () => {
      const bindings = { service: 'test', requestId: 'req-123' };
      const logger = new MockLoggerService(bindings);

      logger.info({ msg: 'Test message', data: { value: 42 } });

      const log = logger.getLastLog();
      expect(log?.context).toEqual({
        service: 'test',
        requestId: 'req-123',
        msg: 'Test message',
        data: { value: 42 },
      });
      expect(log?.bindings).toEqual(bindings);
    });

    test('should override bindings with context when keys conflict', () => {
      const bindings = { service: 'original', requestId: 'req-123' };
      const logger = new MockLoggerService(bindings);

      logger.info({ msg: 'Test', service: 'override' });

      const log = logger.getLastLog();
      expect(log?.context.service).toBe('override');
      expect(log?.context.requestId).toBe('req-123');
    });
  });

  describe('child logger functionality', () => {
    test('should create child logger with additional bindings', () => {
      const parentBindings = { service: 'parent' };
      const parentLogger = new MockLoggerService(parentBindings);

      const childBindings = { component: 'child', operation: 'test' };
      const childLogger = parentLogger.child(childBindings);

      expect(parentLogger.getChildLoggerCount()).toBe(1);
      expect(parentLogger.childLoggers[0]).toBe(childLogger as unknown as MockLoggerService);
    });

    test('should inherit parent bindings in child logger', () => {
      const parentBindings = { service: 'parent', version: '1.0' };
      const parentLogger = new MockLoggerService(parentBindings);

      const childBindings = { component: 'child' };
      const childLogger = parentLogger.child(childBindings) as MockLoggerService;

      childLogger.info({ msg: 'Child message' });

      const log = childLogger.getLastLog();
      expect(log?.context).toMatchObject({
        service: 'parent',
        version: '1.0',
        component: 'child',
        msg: 'Child message',
      });
    });

    test('should override parent bindings in child', () => {
      const parentBindings = { service: 'parent', level: 'parent' };
      const parentLogger = new MockLoggerService(parentBindings);

      const childBindings = { level: 'child', component: 'test' };
      const childLogger = parentLogger.child(childBindings) as MockLoggerService;

      childLogger.info({ msg: 'Test' });

      const log = childLogger.getLastLog();
      expect(log?.context.level).toBe('child');
      expect(log?.context.service).toBe('parent');
      expect(log?.context.component).toBe('test');
    });

    test('should handle child logger options parameter', () => {
      const options = { level: 'debug' };
      const childLogger = mockLogger.child({ component: 'test' }, options);

      expect(childLogger).toBeInstanceOf(MockLoggerService);
      expect(mockLogger.getChildLoggerCount()).toBe(1);
    });

    test('should create multiple child loggers', () => {
      const child1 = mockLogger.child({ component: 'comp1' });
      const child2 = mockLogger.child({ component: 'comp2' });
      const child3 = mockLogger.child({ component: 'comp3' });

      expect(mockLogger.getChildLoggerCount()).toBe(3);
      expect(mockLogger.childLoggers).toHaveLength(3);
    });
  });

  describe('utility methods', () => {
    test('should clear logs and child loggers', () => {
      mockLogger.debug({ msg: 'Test 1' });
      mockLogger.info({ msg: 'Test 2' });
      mockLogger.child({ component: 'test' });

      expect(mockLogger.getLogCount()).toBe(2);
      expect(mockLogger.getChildLoggerCount()).toBe(1);

      mockLogger.clear();

      expect(mockLogger.getLogCount()).toBe(0);
      expect(mockLogger.getChildLoggerCount()).toBe(0);
      expect(mockLogger.logs).toEqual([]);
      expect(mockLogger.childLoggers).toEqual([]);
    });

    test('should get logs by level', () => {
      mockLogger.debug({ msg: 'Debug 1' });
      mockLogger.info({ msg: 'Info 1' });
      mockLogger.debug({ msg: 'Debug 2' });
      mockLogger.warn({ msg: 'Warning 1' });
      mockLogger.info({ msg: 'Info 2' });

      const debugLogs = mockLogger.getLogsByLevel('debug');
      const infoLogs = mockLogger.getLogsByLevel('info');
      const warnLogs = mockLogger.getLogsByLevel('warn');
      const errorLogs = mockLogger.getLogsByLevel('error');

      expect(debugLogs).toHaveLength(2);
      expect(infoLogs).toHaveLength(2);
      expect(warnLogs).toHaveLength(1);
      expect(errorLogs).toHaveLength(0);

      expect(debugLogs[0].context.msg).toBe('Debug 1');
      expect(debugLogs[1].context.msg).toBe('Debug 2');
      expect(infoLogs[0].context.msg).toBe('Info 1');
      expect(infoLogs[1].context.msg).toBe('Info 2');
    });

    test('should check if message was logged', () => {
      mockLogger.info({ msg: 'Test message' });
      mockLogger.error({ msg: 'Error occurred', data: { error: true } });

      expect(mockLogger.hasLoggedMessage('Test message')).toBe(true);
      expect(mockLogger.hasLoggedMessage('Error occurred')).toBe(true);
      expect(mockLogger.hasLoggedMessage('Non-existent message')).toBe(false);
    });

    test('should check if error was logged with string', () => {
      mockLogger.error({ msg: 'Operation failed', error: 'Connection timeout' });
      mockLogger.warn({ msg: 'Connection timeout' });

      expect(mockLogger.hasLoggedError('Connection timeout')).toBe(true);
      expect(mockLogger.hasLoggedError('Database error')).toBe(false);
    });

    test('should check if error was logged with Error object', () => {
      const error = new Error('Database connection failed');
      mockLogger.error({ msg: 'Database error', error });

      expect(mockLogger.hasLoggedError('Database connection failed')).toBe(true);
      expect(mockLogger.hasLoggedError('Database error')).toBe(true);
      expect(mockLogger.hasLoggedError(new Error('Different error'))).toBe(false);
    });

    test('should handle error in context.error field', () => {
      mockLogger.error({ msg: 'System error', error: 'Network failure' });

      expect(mockLogger.hasLoggedError('Network failure')).toBe(true);
    });

    test('should handle error in context.msg field', () => {
      mockLogger.error({ msg: 'Configuration error', component: 'settings' });

      expect(mockLogger.hasLoggedError('Configuration error')).toBe(true);
    });

    test('should get last log entry', () => {
      expect(mockLogger.getLastLog()).toBeUndefined();

      mockLogger.debug({ msg: 'First' });
      expect(mockLogger.getLastLog()?.context.msg).toBe('First');

      mockLogger.info({ msg: 'Second' });
      expect(mockLogger.getLastLog()?.context.msg).toBe('Second');

      mockLogger.warn({ msg: 'Third' });
      expect(mockLogger.getLastLog()?.context.msg).toBe('Third');
    });
  });

  describe('assertion helpers', () => {
    test('should assert logged message successfully', () => {
      mockLogger.info({ msg: 'Success message' });
      mockLogger.error({ msg: 'Error message' });

      expect(() => {
        mockLogger.assertLogged('info', 'Success message');
      }).not.toThrow();

      expect(() => {
        mockLogger.assertLogged('error', 'Error message');
      }).not.toThrow();
    });

    test('should throw when asserting non-existent log', () => {
      mockLogger.info({ msg: 'Existing message' });

      expect(() => {
        mockLogger.assertLogged('info', 'Non-existent message');
      }).toThrow('Expected log not found: [info] Non-existent message');

      expect(() => {
        mockLogger.assertLogged('error', 'Existing message');
      }).toThrow('Expected log not found: [error] Existing message');
    });

    test('should assert not logged successfully', () => {
      mockLogger.info({ msg: 'Info message' });

      expect(() => {
        mockLogger.assertNotLogged('info', 'Different message');
      }).not.toThrow();

      expect(() => {
        mockLogger.assertNotLogged('error', 'Info message');
      }).not.toThrow();
    });

    test('should throw when asserting logged message should not exist', () => {
      mockLogger.warn({ msg: 'Warning message' });

      expect(() => {
        mockLogger.assertNotLogged('warn', 'Warning message');
      }).toThrow('Unexpected log found: [warn] Warning message');
    });

    test('should assert log count successfully', () => {
      expect(() => {
        mockLogger.assertLogCount(0);
      }).not.toThrow();

      mockLogger.debug({ msg: 'Test 1' });
      mockLogger.info({ msg: 'Test 2' });

      expect(() => {
        mockLogger.assertLogCount(2);
      }).not.toThrow();
    });

    test('should throw when log count assertion fails', () => {
      mockLogger.info({ msg: 'Single message' });

      expect(() => {
        mockLogger.assertLogCount(0);
      }).toThrow('Expected 0 logs, but found 1');

      expect(() => {
        mockLogger.assertLogCount(5);
      }).toThrow('Expected 5 logs, but found 1');
    });
  });

  describe('complex scenarios', () => {
    test('should handle complex context objects', () => {
      const complexContext = {
        msg: 'Complex operation',
        user: { id: 123, name: 'John Doe', roles: ['admin', 'user'] },
        metadata: {
          timestamp: new Date(),
          version: '2.0.0',
          features: { a: true, b: false },
        },
        operation: {
          type: 'update',
          target: 'database',
          affected: ['table1', 'table2'],
        },
      };

      mockLogger.info(complexContext);

      const log = mockLogger.getLastLog();
      expect(log?.context).toEqual(complexContext);
    });

    test('should handle concurrent logging operations', () => {
      const operations = Array.from({ length: 100 }, (_, i) => ({
        msg: `Operation ${i}`,
        index: i,
        timestamp: Date.now(),
      }));

      operations.forEach((op) => {
        if (op.index % 4 === 0) mockLogger.debug(op);
        else if (op.index % 4 === 1) mockLogger.info(op);
        else if (op.index % 4 === 2) mockLogger.warn(op);
        else mockLogger.error(op);
      });

      expect(mockLogger.getLogCount()).toBe(100);

      const debugLogs = mockLogger.getLogsByLevel('debug');
      const infoLogs = mockLogger.getLogsByLevel('info');
      const warnLogs = mockLogger.getLogsByLevel('warn');
      const errorLogs = mockLogger.getLogsByLevel('error');

      expect(debugLogs.length + infoLogs.length + warnLogs.length + errorLogs.length).toBe(100);
    });

    test('should maintain parent-child relationship integrity', () => {
      const parentLogger = new MockLoggerService({ service: 'parent' });

      const child1 = parentLogger.child({ component: 'child1' }) as MockLoggerService;
      const child2 = parentLogger.child({ component: 'child2' }) as MockLoggerService;
      const grandchild = child1.child({ subcomponent: 'grandchild' }) as MockLoggerService;

      parentLogger.info({ msg: 'Parent message' });
      child1.info({ msg: 'Child1 message' });
      child2.info({ msg: 'Child2 message' });
      grandchild.info({ msg: 'Grandchild message' });

      // Parent should have 2 children but only its own logs
      expect(parentLogger.getChildLoggerCount()).toBe(2);
      expect(parentLogger.getLogCount()).toBe(1);

      // Child1 should have 1 child and its own logs
      expect(child1.getChildLoggerCount()).toBe(1);
      expect(child1.getLogCount()).toBe(1);

      // Child2 should have no children and its own logs
      expect(child2.getChildLoggerCount()).toBe(0);
      expect(child2.getLogCount()).toBe(1);

      // Grandchild should have no children and its own logs
      expect(grandchild.getChildLoggerCount()).toBe(0);
      expect(grandchild.getLogCount()).toBe(1);

      // Check context inheritance
      expect(child1.getLastLog()?.context).toMatchObject({
        service: 'parent',
        component: 'child1',
        msg: 'Child1 message',
      });

      expect(grandchild.getLastLog()?.context).toMatchObject({
        service: 'parent',
        component: 'child1',
        subcomponent: 'grandchild',
        msg: 'Grandchild message',
      });
    });

    test('should handle edge cases in assertions', () => {
      // Empty message
      mockLogger.info({ msg: '' });
      expect(() => mockLogger.assertLogged('info', '')).not.toThrow();

      // Special characters in message
      const specialMessage = 'Message with "quotes" and \n newlines \t tabs';
      mockLogger.warn({ msg: specialMessage });
      expect(() => mockLogger.assertLogged('warn', specialMessage)).not.toThrow();

      // Unicode characters
      const unicodeMessage = 'Unicode: 🚀 émojis and çháráctérs';
      mockLogger.debug({ msg: unicodeMessage });
      expect(() => mockLogger.assertLogged('debug', unicodeMessage)).not.toThrow();
    });

    test('should handle large log volumes efficiently', () => {
      const startTime = Date.now();

      // Generate 1000 log entries
      for (let i = 0; i < 1000; i++) {
        mockLogger.info({
          msg: `Log entry ${i}`,
          index: i,
          data: { processed: true, timestamp: Date.now() },
        });
      }

      const endTime = Date.now();

      expect(mockLogger.getLogCount()).toBe(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second

      // Test filtering performance
      const filterStartTime = Date.now();
      const infoLogs = mockLogger.getLogsByLevel('info');
      const filterEndTime = Date.now();

      expect(infoLogs.length).toBe(1000);
      expect(filterEndTime - filterStartTime).toBeLessThan(100); // Should filter quickly
    });
  });
});