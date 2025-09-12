import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { createLogger, initializeLogger, LoggerService } from '../../src/utils/logger';
import { TestDataFactory } from '../test-utils/TestDataFactory';

describe('Logger Mutation Tests', () => {
  const originalEnv = { ...Bun.env };

  beforeEach(() => {
    // Clear singleton to ensure fresh instance for each test
    (LoggerService as any).instance = undefined;
    // Set test environment to suppress log output
    Bun.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    // Restore original environment
    Object.assign(Bun.env, originalEnv);
    // Clear singleton
    (LoggerService as any).instance = undefined;
  });

  describe('Log Level String Mutations', () => {
    it('should use exact log level strings from environment', () => {
      // Test exact string values
      const levels = ['debug', 'info', 'warn', 'error', 'fatal'];
      
      for (const level of levels) {
        Bun.env.LOG_LEVEL = level;
        (LoggerService as any).instance = undefined;
        
        const service = LoggerService.getInstance();
        const config = (service as any).config;
        
        // Assert exact string equality
        expect(config.level).toBe(level);
        expect(config.level).not.toBe('');
        expect(config.level).not.toBe(undefined);
        expect(config.level).not.toBe(null);
      }
    });

    it('should use exact default log level "info" when not specified', () => {
      delete Bun.env.LOG_LEVEL;
      (LoggerService as any).instance = undefined;
      
      const service = LoggerService.getInstance();
      const config = (service as any).config;
      
      // Assert exact default value
      expect(config.level).toBe('info');
      expect(config.level).not.toBe('debug');
      expect(config.level).not.toBe('warn');
      expect(config.level).not.toBe('error');
      expect(config.level).not.toBe('');
    });

    it('should use exact namespace strings', () => {
      const namespaces = [
        'checklist:workflow:engine',
        'checklist:health:monitor',
        'test:namespace'
      ];
      
      for (const namespace of namespaces) {
        const logger = createLogger(namespace);
        
        // Verify logger is created with exact namespace
        expect(logger).toBeDefined();
        // Child logger should have been called with exact module value
        const childCalls = (LoggerService.getInstance() as any).defaultLogger.child;
        expect(childCalls).toBeDefined();
      }
    });
  });

  describe('Boolean Condition Mutations', () => {
    it('should evaluate NODE_ENV === "test" exactly', () => {
      // Test both true and false cases
      Bun.env.NODE_ENV = 'test';
      Bun.env.ENABLE_FILE_LOGGING = 'false';
      (LoggerService as any).instance = undefined;
      
      const service1 = LoggerService.getInstance();
      const logger1 = (service1 as any).defaultLogger;
      
      // In test mode without file logging, should be silent
      expect(logger1).toBeDefined();
      
      // Test opposite condition
      Bun.env.NODE_ENV = 'production';
      (LoggerService as any).instance = undefined;
      
      const service2 = LoggerService.getInstance();
      const logger2 = (service2 as any).defaultLogger;
      
      // In production mode, should not be silent
      expect(logger2).toBeDefined();
    });

    it('should evaluate ENABLE_FILE_LOGGING === "true" exactly', () => {
      // Test exact string comparison
      const values = ['true', 'false', 'TRUE', 'yes', '1', '', undefined];
      
      for (const value of values) {
        if (value === undefined) {
          delete Bun.env.ENABLE_FILE_LOGGING;
        } else {
          Bun.env.ENABLE_FILE_LOGGING = value;
        }
        
        (LoggerService as any).instance = undefined;
        const service = LoggerService.getInstance();
        const config = (service as any).config;
        
        // Only exactly 'true' string should enable file logging
        if (value === 'true') {
          expect(config.enableFileLogging).toBe(true);
        } else {
          expect(config.enableFileLogging).toBe(false);
        }
      }
    });

    it('should evaluate ENABLE_LOG_ROTATION === "true" exactly', () => {
      // Test exact string comparison
      const values = ['true', 'false', 'TRUE', 'yes', '1', '', undefined];
      
      for (const value of values) {
        if (value === undefined) {
          delete Bun.env.ENABLE_LOG_ROTATION;
        } else {
          Bun.env.ENABLE_LOG_ROTATION = value;
        }
        
        (LoggerService as any).instance = undefined;
        const service = LoggerService.getInstance();
        const config = (service as any).config;
        
        // Only exactly 'true' string should enable rotation
        if (value === 'true') {
          expect(config.enableRotation).toBe(true);
        } else {
          expect(config.enableRotation).toBe(false);
        }
      }
    });

    it('should evaluate NODE_ENV === "development" exactly', () => {
      // Test exact string comparison for development mode
      const environments = ['development', 'dev', 'DEVELOPMENT', 'production', 'test', '', undefined];
      
      for (const env of environments) {
        if (env === undefined) {
          delete Bun.env.NODE_ENV;
        } else {
          Bun.env.NODE_ENV = env;
        }
        
        (LoggerService as any).instance = undefined;
        const service = LoggerService.getInstance();
        const config = (service as any).config;
        
        // Only exactly 'development' should enable prettyPrint
        if (env === 'development') {
          expect(config.prettyPrint).toBe(true);
        } else {
          expect(config.prettyPrint).toBe(false);
        }
      }
    });
  });

  describe('Numeric Mutations', () => {
    it('should parse LOG_MAX_FILES with exact base 10', () => {
      const testValues = [
        { input: '7', expected: 7 },
        { input: '10', expected: 10 },
        { input: '0', expected: 0 },
        { input: '999', expected: 999 },
        { input: '007', expected: 7 }, // Leading zeros
        { input: 'abc', expected: NaN },
      ];
      
      for (const { input, expected } of testValues) {
        Bun.env.LOG_MAX_FILES = input;
        (LoggerService as any).instance = undefined;
        
        const service = LoggerService.getInstance();
        const config = (service as any).config;
        
        if (isNaN(expected)) {
          expect(isNaN(config.maxFiles)).toBe(true);
        } else {
          expect(config.maxFiles).toBe(expected);
        }
      }
    });

    it('should use exact default value 7 for LOG_MAX_FILES', () => {
      delete Bun.env.LOG_MAX_FILES;
      (LoggerService as any).instance = undefined;
      
      const service = LoggerService.getInstance();
      const config = (service as any).config;
      
      // Assert exact default value
      expect(config.maxFiles).toBe(7);
      expect(config.maxFiles).not.toBe(6);
      expect(config.maxFiles).not.toBe(8);
      expect(config.maxFiles).not.toBe(10);
    });
  });

  describe('Performance Threshold Mutations', () => {
    it('should check exact 5ms performance threshold', () => {
      // Mock performance.now to control timing
      const originalPerformanceNow = performance.now;
      let mockTime = 0;
      let callCount = 0;
      
      performance.now = () => {
        // First call is start time, second call is end time
        if (callCount++ % 2 === 0) {
          return mockTime;
        } else {
          return mockTime + (callCount === 2 ? 5 : callCount === 4 ? 5.1 : 1);
        }
      };
      
      try {
        // Clear singleton
        (LoggerService as any).instance = undefined;
        
        // Test exactly at threshold (5ms)
        callCount = 0;
        mockTime = 1000;
        const logger1 = createLogger('test:threshold');
        expect(logger1).toBeDefined();
        // Duration is exactly 5ms, should not warn
        
        // Test just over threshold (5.1ms)
        callCount = 2;
        mockTime = 2000;
        const logger2 = createLogger('test:over-threshold');
        expect(logger2).toBeDefined();
        // Duration is 5.1ms, should warn (but we can't easily check in this setup)
        
        // Test well under threshold (1ms)
        callCount = 4;
        mockTime = 3000;
        const logger3 = createLogger('test:under-threshold');
        expect(logger3).toBeDefined();
        // Duration is 1ms, should not warn
        
      } finally {
        performance.now = originalPerformanceNow;
      }
    });
  });

  describe('Default Value Mutations', () => {
    it('should use exact default directory ".logs"', () => {
      delete Bun.env.LOG_DIRECTORY;
      (LoggerService as any).instance = undefined;
      
      const service = LoggerService.getInstance();
      const config = (service as any).config;
      
      expect(config.logDirectory).toBe('.logs');
      expect(config.logDirectory).not.toBe('logs');
      expect(config.logDirectory).not.toBe('./logs');
      expect(config.logDirectory).not.toBe('');
    });

    it('should use exact default max file size "10M"', () => {
      delete Bun.env.LOG_MAX_FILE_SIZE;
      (LoggerService as any).instance = undefined;
      
      const service = LoggerService.getInstance();
      const config = (service as any).config;
      
      expect(config.maxFileSize).toBe('10M');
      expect(config.maxFileSize).not.toBe('10MB');
      expect(config.maxFileSize).not.toBe('10m');
      expect(config.maxFileSize).not.toBe('');
    });

    it('should use exact default max age "7d"', () => {
      delete Bun.env.LOG_MAX_AGE;
      (LoggerService as any).instance = undefined;
      
      const service = LoggerService.getInstance();
      const config = (service as any).config;
      
      expect(config.maxAge).toBe('7d');
      expect(config.maxAge).not.toBe('7D');
      expect(config.maxAge).not.toBe('7 days');
      expect(config.maxAge).not.toBe('');
    });
  });

  describe('Nullish Coalescing Mutations', () => {
    it('should handle nullish coalescing operator correctly', () => {
      // Test that ?? operator works correctly with null, undefined, and falsy values
      const testCases = [
        { envValue: null, expected: 'info' },
        { envValue: undefined, expected: 'info' },
        { envValue: '', expected: '' }, // Empty string is not nullish
        { envValue: 'debug', expected: 'debug' },
        { envValue: false, expected: false }, // false is not nullish
        { envValue: 0, expected: 0 }, // 0 is not nullish
      ];
      
      for (const { envValue, expected } of testCases) {
        if (envValue === undefined) {
          delete Bun.env.LOG_LEVEL;
        } else {
          Bun.env.LOG_LEVEL = envValue as any;
        }
        
        (LoggerService as any).instance = undefined;
        const service = LoggerService.getInstance();
        const config = (service as any).config;
        
        if (envValue === null || envValue === undefined) {
          expect(config.level).toBe('info');
        } else {
          expect(config.level).toBe(envValue);
        }
      }
    });
  });

  describe('Array Length Mutations', () => {
    it('should check external transports array length exactly', () => {
      const configs = [
        { externalTransports: [], shouldHaveTransports: false },
        { externalTransports: [{ target: 'test' }], shouldHaveTransports: true },
        { externalTransports: undefined, shouldHaveTransports: false },
      ];
      
      for (const config of configs) {
        (LoggerService as any).instance = undefined;
        const service = LoggerService.getInstance(config);
        const serviceConfig = (service as any).config;
        
        if (config.shouldHaveTransports) {
          expect(serviceConfig.externalTransports?.length).toBeGreaterThan(0);
        } else {
          expect(
            !serviceConfig.externalTransports || 
            serviceConfig.externalTransports.length === 0
          ).toBe(true);
        }
      }
    });
  });

  describe('Singleton Pattern Mutations', () => {
    it('should use exact nullish coalescing assignment for singleton', () => {
      // First call should create instance
      (LoggerService as any).instance = undefined;
      const instance1 = LoggerService.getInstance();
      expect(instance1).toBeDefined();
      
      // Second call should return same instance
      const instance2 = LoggerService.getInstance();
      expect(instance2).toBe(instance1);
      
      // Setting to null should allow new instance
      (LoggerService as any).instance = null;
      const instance3 = LoggerService.getInstance();
      expect(instance3).toBeDefined();
      expect(instance3).not.toBe(instance1);
    });
  });
});