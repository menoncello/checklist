import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { LoggerServiceAdapter } from '../../src/services/LoggerServiceAdapter';
import { LoggerService } from '../../src/utils/logger';
import type { ILogger, LogContext } from '../../src/interfaces/ILogger';

describe('LoggerServiceAdapter', () => {
  let mockLoggerService: any;
  let mockLogger: any;

  beforeEach(() => {
    // Clear singleton
    (LoggerServiceAdapter as any).instance = null;
    
    // Create mock logger with all methods
    mockLogger = {
      debug: mock(() => {}),
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
      fatal: mock(() => {}),
      child: mock(() => mockLogger), // Return itself for simplicity
    };
    
    // Create mock LoggerService
    mockLoggerService = {
      createLogger: mock(() => mockLogger),
    };
  });

  describe('fromSingleton', () => {
    it('should create singleton instance on first call', () => {
      const adapter1 = LoggerServiceAdapter.fromSingleton();
      expect(adapter1).toBeDefined();
      expect(adapter1).toBeInstanceOf(LoggerServiceAdapter);
    });

    it('should return same instance on subsequent calls', () => {
      const adapter1 = LoggerServiceAdapter.fromSingleton();
      const adapter2 = LoggerServiceAdapter.fromSingleton();
      expect(adapter1).toBe(adapter2);
    });

    it('should use exact nullish coalescing assignment', () => {
      // First call creates instance
      (LoggerServiceAdapter as any).instance = null;
      const adapter1 = LoggerServiceAdapter.fromSingleton();
      expect(adapter1).toBeDefined();
      
      // Second call uses existing
      const adapter2 = LoggerServiceAdapter.fromSingleton();
      expect(adapter2).toBe(adapter1);
      
      // Setting to undefined should still use existing
      (LoggerServiceAdapter as any).instance = undefined;
      const adapter3 = LoggerServiceAdapter.fromSingleton();
      expect(adapter3).toBeDefined();
    });

    it('should create logger with exact namespace "DI"', () => {
      // Mock LoggerService.getInstance
      const mockGetInstance = mock(() => mockLoggerService);
      (LoggerService as any).getInstance = mockGetInstance;
      
      const adapter = LoggerServiceAdapter.fromSingleton();
      expect(mockLoggerService.createLogger).toHaveBeenCalledWith('DI');
    });
  });

  describe('create', () => {
    it('should create new instance with provided LoggerService', () => {
      const adapter = LoggerServiceAdapter.create(mockLoggerService);
      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(LoggerServiceAdapter);
    });

    it('should create logger with exact namespace "DI"', () => {
      const adapter = LoggerServiceAdapter.create(mockLoggerService);
      expect(mockLoggerService.createLogger).toHaveBeenCalledWith('DI');
    });

    it('should create different instances on each call', () => {
      const adapter1 = LoggerServiceAdapter.create(mockLoggerService);
      const adapter2 = LoggerServiceAdapter.create(mockLoggerService);
      expect(adapter1).not.toBe(adapter2);
    });
  });

  describe('logging methods', () => {
    let adapter: LoggerServiceAdapter;
    
    beforeEach(() => {
      adapter = LoggerServiceAdapter.create(mockLoggerService);
    });

    it('should forward debug calls with exact context', () => {
      const context: LogContext = { msg: 'Debug message', level: 'debug' };
      adapter.debug(context);
      expect(mockLogger.debug).toHaveBeenCalledWith(context);
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
    });

    it('should forward info calls with exact context', () => {
      const context: LogContext = { msg: 'Info message', data: 42 };
      adapter.info(context);
      expect(mockLogger.info).toHaveBeenCalledWith(context);
      expect(mockLogger.info).toHaveBeenCalledTimes(1);
    });

    it('should forward warn calls with exact context', () => {
      const context: LogContext = { msg: 'Warning', threshold: 100 };
      adapter.warn(context);
      expect(mockLogger.warn).toHaveBeenCalledWith(context);
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });

    it('should forward error calls with exact context', () => {
      const error = new Error('Test error');
      const context: LogContext = { msg: 'Error occurred', error };
      adapter.error(context);
      expect(mockLogger.error).toHaveBeenCalledWith(context);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });

    it('should forward fatal calls with exact context', () => {
      const context: LogContext = { msg: 'Fatal error', code: 'FATAL_001' };
      adapter.fatal(context);
      expect(mockLogger.fatal).toHaveBeenCalledWith(context);
      expect(mockLogger.fatal).toHaveBeenCalledTimes(1);
    });

    it('should handle all log levels in sequence', () => {
      adapter.debug({ msg: 'Debug' });
      adapter.info({ msg: 'Info' });
      adapter.warn({ msg: 'Warn' });
      adapter.error({ msg: 'Error' });
      adapter.fatal({ msg: 'Fatal' });
      
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.fatal).toHaveBeenCalledTimes(1);
    });
  });

  describe('child logger', () => {
    let adapter: LoggerServiceAdapter;
    
    beforeEach(() => {
      adapter = LoggerServiceAdapter.create(mockLoggerService);
    });

    it('should create child logger with exact bindings', () => {
      const bindings = { requestId: '123', userId: 'user456' };
      const child = adapter.child(bindings);
      
      expect(mockLogger.child).toHaveBeenCalledWith(bindings, undefined);
      expect(child).toBeDefined();
    });

    it('should create child logger with bindings and options', () => {
      const bindings = { requestId: '123' };
      const options = { level: 'debug' };
      const child = adapter.child(bindings, options);
      
      expect(mockLogger.child).toHaveBeenCalledWith(bindings, options);
      expect(child).toBeDefined();
    });

    it('should return ILogger interface with all methods', () => {
      const child = adapter.child({ test: true });
      
      expect(child.debug).toBeDefined();
      expect(child.info).toBeDefined();
      expect(child.warn).toBeDefined();
      expect(child.error).toBeDefined();
      expect(child.fatal).toBeDefined();
      expect(child.child).toBeDefined();
    });

    it('should forward child logger method calls', () => {
      const childMockLogger = {
        debug: mock(() => {}),
        info: mock(() => {}),
        warn: mock(() => {}),
        error: mock(() => {}),
        fatal: mock(() => {}),
        child: mock(() => childMockLogger),
      };
      
      mockLogger.child.mockReturnValue(childMockLogger);
      
      const child = adapter.child({ test: true });
      
      // Test all child logger methods
      child.debug({ msg: 'Child debug' });
      expect(childMockLogger.debug).toHaveBeenCalledWith({ msg: 'Child debug' });
      
      child.info({ msg: 'Child info' });
      expect(childMockLogger.info).toHaveBeenCalledWith({ msg: 'Child info' });
      
      child.warn({ msg: 'Child warn' });
      expect(childMockLogger.warn).toHaveBeenCalledWith({ msg: 'Child warn' });
      
      child.error({ msg: 'Child error' });
      expect(childMockLogger.error).toHaveBeenCalledWith({ msg: 'Child error' });
      
      child.fatal({ msg: 'Child fatal' });
      expect(childMockLogger.fatal).toHaveBeenCalledWith({ msg: 'Child fatal' });
    });

    it('should support nested child loggers', () => {
      const child1 = adapter.child({ level1: true });
      const child2 = child1.child({ level2: true });
      const child3 = child2.child({ level3: true });
      
      expect(child1).toBeDefined();
      expect(child2).toBeDefined();
      expect(child3).toBeDefined();
      
      // All should have ILogger interface
      expect(child3.debug).toBeDefined();
      expect(child3.info).toBeDefined();
      expect(child3.warn).toBeDefined();
      expect(child3.error).toBeDefined();
      expect(child3.fatal).toBeDefined();
      expect(child3.child).toBeDefined();
    });

    it('should handle empty bindings', () => {
      const child = adapter.child({});
      expect(mockLogger.child).toHaveBeenCalledWith({}, undefined);
      expect(child).toBeDefined();
    });

    it('should handle null options', () => {
      const child = adapter.child({ test: true }, null as any);
      expect(mockLogger.child).toHaveBeenCalledWith({ test: true }, null);
      expect(child).toBeDefined();
    });
  });

  describe('getLoggerService', () => {
    it('should return the underlying LoggerService', () => {
      const adapter = LoggerServiceAdapter.create(mockLoggerService);
      const service = adapter.getLoggerService();
      expect(service).toBe(mockLoggerService);
    });

    it('should return same service instance on multiple calls', () => {
      const adapter = LoggerServiceAdapter.create(mockLoggerService);
      const service1 = adapter.getLoggerService();
      const service2 = adapter.getLoggerService();
      expect(service1).toBe(service2);
      expect(service1).toBe(mockLoggerService);
    });
  });

  describe('edge cases', () => {
    let adapter: LoggerServiceAdapter;
    
    beforeEach(() => {
      adapter = LoggerServiceAdapter.create(mockLoggerService);
    });

    it('should handle undefined msg in context', () => {
      adapter.info({ msg: undefined as any });
      expect(mockLogger.info).toHaveBeenCalledWith({ msg: undefined });
    });

    it('should handle null msg in context', () => {
      adapter.info({ msg: null as any });
      expect(mockLogger.info).toHaveBeenCalledWith({ msg: null });
    });

    it('should handle empty string msg', () => {
      adapter.info({ msg: '' });
      expect(mockLogger.info).toHaveBeenCalledWith({ msg: '' });
    });

    it('should handle very long messages', () => {
      const longMsg = 'x'.repeat(10000);
      adapter.info({ msg: longMsg });
      expect(mockLogger.info).toHaveBeenCalledWith({ msg: longMsg });
    });

    it('should handle special characters in messages', () => {
      const specialMsg = '🎉 \n\r\t\0 ${injection} <script>';
      adapter.info({ msg: specialMsg });
      expect(mockLogger.info).toHaveBeenCalledWith({ msg: specialMsg });
    });

    it('should handle circular references in context', () => {
      const circular: any = { msg: 'Test' };
      circular.self = circular;
      adapter.info(circular);
      expect(mockLogger.info).toHaveBeenCalledWith(circular);
    });

    it('should handle large context objects', () => {
      const largeContext: LogContext = {
        msg: 'Large context',
        data: Array(1000).fill({ key: 'value' }),
      };
      adapter.info(largeContext);
      expect(mockLogger.info).toHaveBeenCalledWith(largeContext);
    });
  });
});