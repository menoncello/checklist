import { describe, it, expect, beforeEach } from 'bun:test';
import { MockLogger, InMemoryLogger } from './MockLogger';
import type { LogContext } from '../../src/utils/logger';

describe('MockLogger', () => {
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockLogger = new MockLogger();
  });

  describe('logging methods', () => {
    it('should capture debug calls', () => {
      const context: LogContext = { msg: 'Debug message', data: 'test' };
      mockLogger.debug(context);

      expect(mockLogger.debugCalls).toHaveLength(1);
      expect(mockLogger.debugCalls[0]).toEqual(context);
    });

    it('should capture info calls', () => {
      const context: LogContext = { msg: 'Info message' };
      mockLogger.info(context);

      expect(mockLogger.infoCalls).toHaveLength(1);
      expect(mockLogger.infoCalls[0]).toEqual(context);
    });

    it('should capture warn calls', () => {
      const context: LogContext = { msg: 'Warning message' };
      mockLogger.warn(context);

      expect(mockLogger.warnCalls).toHaveLength(1);
      expect(mockLogger.warnCalls[0]).toEqual(context);
    });

    it('should capture error calls', () => {
      const context: LogContext = { msg: 'Error message', error: new Error('test') };
      mockLogger.error(context);

      expect(mockLogger.errorCalls).toHaveLength(1);
      expect(mockLogger.errorCalls[0]).toEqual(context);
    });

    it('should capture fatal calls', () => {
      const context: LogContext = { msg: 'Fatal message' };
      mockLogger.fatal(context);

      expect(mockLogger.fatalCalls).toHaveLength(1);
      expect(mockLogger.fatalCalls[0]).toEqual(context);
    });

    it('should capture multiple calls of different types', () => {
      mockLogger.debug({ msg: 'Debug 1' });
      mockLogger.info({ msg: 'Info 1' });
      mockLogger.debug({ msg: 'Debug 2' });
      mockLogger.error({ msg: 'Error 1' });

      expect(mockLogger.debugCalls).toHaveLength(2);
      expect(mockLogger.infoCalls).toHaveLength(1);
      expect(mockLogger.errorCalls).toHaveLength(1);
      expect(mockLogger.warnCalls).toHaveLength(0);
      expect(mockLogger.fatalCalls).toHaveLength(0);
    });
  });

  describe('child logger functionality', () => {
    it('should create child logger with bindings', () => {
      const bindings = { service: 'test-service', requestId: '123' };
      const child = mockLogger.child(bindings);

      expect(child).toBeInstanceOf(MockLogger);
      expect(mockLogger.childCalls).toHaveLength(1);
      expect(mockLogger.childCalls[0].bindings).toEqual(bindings);
      expect(mockLogger.childCalls[0].options).toBeUndefined();
    });

    it('should create child logger with bindings and options', () => {
      const bindings = { service: 'test-service' };
      const options = { level: 'info' };
      const child = mockLogger.child(bindings, options);

      expect(child).toBeInstanceOf(MockLogger);
      expect(mockLogger.childCalls).toHaveLength(1);
      expect(mockLogger.childCalls[0].bindings).toEqual(bindings);
      expect(mockLogger.childCalls[0].options).toEqual(options);
    });

    it('should copy parent calls to child logger', () => {
      mockLogger.info({ msg: 'Parent info' });
      mockLogger.error({ msg: 'Parent error' });

      const child = mockLogger.child({ service: 'test' });

      expect(child.infoCalls).toHaveLength(1);
      expect(child.infoCalls[0]).toEqual({ msg: 'Parent info' });
      expect(child.errorCalls).toHaveLength(1);
      expect(child.errorCalls[0]).toEqual({ msg: 'Parent error' });
    });

    it('should maintain separate call arrays for parent and child', () => {
      const child = mockLogger.child({ service: 'test' });

      mockLogger.info({ msg: 'Parent after child' });
      child.info({ msg: 'Child message' });

      expect(mockLogger.infoCalls).toHaveLength(1);
      expect(mockLogger.infoCalls[0].msg).toBe('Parent after child');

      expect(child.infoCalls).toHaveLength(1);
      expect(child.infoCalls[0].msg).toBe('Child message');
    });
  });

  describe('helper methods', () => {
    beforeEach(() => {
      mockLogger.debug({ msg: 'Debug message' });
      mockLogger.info({ msg: 'Info message' });
      mockLogger.warn({ msg: 'Warning message' });
      mockLogger.error({ msg: 'Error message' });
      mockLogger.fatal({ msg: 'Fatal message' });
    });

    it('should clear all calls', () => {
      expect(mockLogger.getAllCalls()).toHaveLength(5);

      mockLogger.clear();

      expect(mockLogger.debugCalls).toHaveLength(0);
      expect(mockLogger.infoCalls).toHaveLength(0);
      expect(mockLogger.warnCalls).toHaveLength(0);
      expect(mockLogger.errorCalls).toHaveLength(0);
      expect(mockLogger.fatalCalls).toHaveLength(0);
      expect(mockLogger.childCalls).toHaveLength(0);
      expect(mockLogger.getAllCalls()).toHaveLength(0);
    });

    it('should get all calls in order', () => {
      const allCalls = mockLogger.getAllCalls();

      expect(allCalls).toHaveLength(5);
      expect(allCalls[0].msg).toBe('Debug message');
      expect(allCalls[1].msg).toBe('Info message');
      expect(allCalls[2].msg).toBe('Warning message');
      expect(allCalls[3].msg).toBe('Error message');
      expect(allCalls[4].msg).toBe('Fatal message');
    });

    it('should check if message was logged without level filter', () => {
      expect(mockLogger.hasLoggedMessage('Debug message')).toBe(true);
      expect(mockLogger.hasLoggedMessage('Info message')).toBe(true);
      expect(mockLogger.hasLoggedMessage('Error message')).toBe(true);
      expect(mockLogger.hasLoggedMessage('Non-existent message')).toBe(false);
    });

    it('should check if message was logged at specific level', () => {
      expect(mockLogger.hasLoggedMessage('Debug message', 'debug')).toBe(true);
      expect(mockLogger.hasLoggedMessage('Info message', 'info')).toBe(true);
      expect(mockLogger.hasLoggedMessage('Warning message', 'warn')).toBe(true);
      expect(mockLogger.hasLoggedMessage('Error message', 'error')).toBe(true);
      expect(mockLogger.hasLoggedMessage('Fatal message', 'fatal')).toBe(true);

      // Test wrong level combinations
      expect(mockLogger.hasLoggedMessage('Debug message', 'info')).toBe(false);
      expect(mockLogger.hasLoggedMessage('Info message', 'error')).toBe(false);
      expect(mockLogger.hasLoggedMessage('Non-existent', 'debug')).toBe(false);
    });

    it('should check if error was logged in error calls', () => {
      const testError = new Error('Test error');
      mockLogger.error({ msg: 'Error with object', error: testError });

      expect(mockLogger.hasLoggedError(testError)).toBe(true);
      expect(mockLogger.hasLoggedError(new Error('Different error'))).toBe(false);
    });

    it('should check if error was logged in fatal calls', () => {
      const testError = new Error('Fatal error');
      mockLogger.fatal({ msg: 'Fatal with object', error: testError });

      expect(mockLogger.hasLoggedError(testError)).toBe(true);
    });

    it('should check if unknown error was logged', () => {
      const unknownError = { message: 'Unknown error type' };
      mockLogger.error({ msg: 'Error with unknown', error: unknownError });

      expect(mockLogger.hasLoggedError(unknownError)).toBe(true);
    });

    it('should handle getCallsForLevel with all levels', () => {
      // Test private method through hasLoggedMessage
      expect(mockLogger.hasLoggedMessage('Debug message', 'debug')).toBe(true);
      expect(mockLogger.hasLoggedMessage('Info message', 'info')).toBe(true);
      expect(mockLogger.hasLoggedMessage('Warning message', 'warn')).toBe(true);
      expect(mockLogger.hasLoggedMessage('Error message', 'error')).toBe(true);
      expect(mockLogger.hasLoggedMessage('Fatal message', 'fatal')).toBe(true);
    });
  });

  describe('edge cases and complex scenarios', () => {
    it('should handle empty log contexts', () => {
      const emptyContext: LogContext = { msg: '' };
      mockLogger.info(emptyContext);

      expect(mockLogger.infoCalls).toHaveLength(1);
      expect(mockLogger.hasLoggedMessage('')).toBe(true);
    });

    it('should handle complex log contexts', () => {
      const complexContext: LogContext = {
        msg: 'Complex message',
        userId: 123,
        metadata: {
          nested: {
            value: 'test',
            array: [1, 2, 3]
          }
        },
        error: new Error('Nested error')
      };

      mockLogger.warn(complexContext);

      expect(mockLogger.warnCalls).toHaveLength(1);
      expect(mockLogger.warnCalls[0]).toEqual(complexContext);
      expect(mockLogger.hasLoggedMessage('Complex message', 'warn')).toBe(true);
    });

    it('should handle multiple child logger creation', () => {
      const child1 = mockLogger.child({ service: 'service1' });
      const child2 = mockLogger.child({ service: 'service2' });

      expect(mockLogger.childCalls).toHaveLength(2);
      expect(child1).not.toBe(child2);
      expect(child1).toBeInstanceOf(MockLogger);
      expect(child2).toBeInstanceOf(MockLogger);
    });

    it('should handle child logger inheritance correctly', () => {
      mockLogger.debug({ msg: 'Parent debug' });
      mockLogger.info({ msg: 'Parent info' });

      const child = mockLogger.child({ service: 'test' });

      // Child should have copies of parent calls
      expect(child.debugCalls).toHaveLength(1);
      expect(child.infoCalls).toHaveLength(1);

      // Verify they are copies, not references
      mockLogger.debug({ msg: 'New parent debug' });
      expect(mockLogger.debugCalls).toHaveLength(2);
      expect(child.debugCalls).toHaveLength(1); // Child should still have only original call
    });
  });
});

describe('InMemoryLogger', () => {
  let inMemoryLogger: InMemoryLogger;

  beforeEach(() => {
    inMemoryLogger = new InMemoryLogger();
  });

  describe('logging methods', () => {
    it('should store debug logs with timestamp', () => {
      const context: LogContext = { msg: 'Debug message' };
      inMemoryLogger.debug(context);

      const logs = inMemoryLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('debug');
      expect(logs[0].context).toEqual(context);
      expect(logs[0].timestamp).toBeInstanceOf(Date);
    });

    it('should store info logs with timestamp', () => {
      const context: LogContext = { msg: 'Info message' };
      inMemoryLogger.info(context);

      const logs = inMemoryLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].context).toEqual(context);
    });

    it('should store warn logs with timestamp', () => {
      const context: LogContext = { msg: 'Warning message' };
      inMemoryLogger.warn(context);

      const logs = inMemoryLogger.getLogs();
      expect(logs[0].level).toBe('warn');
    });

    it('should store error logs with timestamp', () => {
      const context: LogContext = { msg: 'Error message' };
      inMemoryLogger.error(context);

      const logs = inMemoryLogger.getLogs();
      expect(logs[0].level).toBe('error');
    });

    it('should store fatal logs with timestamp', () => {
      const context: LogContext = { msg: 'Fatal message' };
      inMemoryLogger.fatal(context);

      const logs = inMemoryLogger.getLogs();
      expect(logs[0].level).toBe('fatal');
    });

    it('should store multiple logs in chronological order', () => {
      inMemoryLogger.info({ msg: 'First' });
      inMemoryLogger.error({ msg: 'Second' });
      inMemoryLogger.debug({ msg: 'Third' });

      const logs = inMemoryLogger.getLogs();
      expect(logs).toHaveLength(3);
      expect(logs[0].context.msg).toBe('First');
      expect(logs[1].context.msg).toBe('Second');
      expect(logs[2].context.msg).toBe('Third');
    });
  });

  describe('child logger functionality', () => {
    it('should create child logger that inherits parent logs', () => {
      inMemoryLogger.info({ msg: 'Parent log' });

      const child = inMemoryLogger.child({ service: 'test' });

      expect(child).toBeInstanceOf(InMemoryLogger);
      expect(child.getLogs()).toHaveLength(1);
      expect(child.getLogs()[0].context.msg).toBe('Parent log');
    });

    it('should create child logger with options', () => {
      const child = inMemoryLogger.child({ service: 'test' }, { level: 'warn' });

      expect(child).toBeInstanceOf(InMemoryLogger);
      expect(child.getLogs()).toHaveLength(0);
    });

    it('should maintain separate logs for parent and child after creation', () => {
      const child = inMemoryLogger.child({ service: 'test' });

      inMemoryLogger.info({ msg: 'Parent after child' });
      child.error({ msg: 'Child message' });

      expect(inMemoryLogger.getLogs()).toHaveLength(1);
      expect(inMemoryLogger.getLogs()[0].context.msg).toBe('Parent after child');

      expect(child.getLogs()).toHaveLength(1);
      expect(child.getLogs()[0].context.msg).toBe('Child message');
    });
  });

  describe('helper methods', () => {
    it('should return copy of logs', () => {
      inMemoryLogger.info({ msg: 'Test message' });

      const logs1 = inMemoryLogger.getLogs();
      const logs2 = inMemoryLogger.getLogs();

      expect(logs1).toEqual(logs2);
      expect(logs1).not.toBe(logs2); // Should be different array instances

      // Modifying returned array should not affect internal logs
      logs1.push({
        level: 'external',
        context: { msg: 'External' },
        timestamp: new Date()
      });

      expect(inMemoryLogger.getLogs()).toHaveLength(1);
    });

    it('should clear all logs', () => {
      inMemoryLogger.info({ msg: 'Message 1' });
      inMemoryLogger.error({ msg: 'Message 2' });

      expect(inMemoryLogger.getLogs()).toHaveLength(2);

      inMemoryLogger.clear();

      expect(inMemoryLogger.getLogs()).toHaveLength(0);
    });

    it('should handle complex log contexts', () => {
      const complexContext: LogContext = {
        msg: 'Complex message',
        data: {
          nested: { value: 123 },
          array: ['a', 'b', 'c']
        },
        error: new Error('Test error')
      };

      inMemoryLogger.warn(complexContext);

      const logs = inMemoryLogger.getLogs();
      expect(logs[0].context).toEqual(complexContext);
      expect(logs[0].level).toBe('warn');
    });
  });
});