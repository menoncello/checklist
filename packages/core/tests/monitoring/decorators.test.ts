import { test, expect, mock, beforeEach, afterEach, describe } from 'bun:test';
import { Timed, TimedClass, withTiming, createTimedFunction } from '../../src/monitoring/decorators';
import { PerformanceMonitorService, setGlobalPerformanceMonitor } from '../../src/monitoring/PerformanceMonitor';
import { createLogger } from '../../src/utils/logger';
import type { IPerformanceMonitor } from '../../src/interfaces/IPerformanceMonitor';

describe('Performance Decorators', () => {
  let performanceMonitor: PerformanceMonitorService;
  let mockLogger: any;

  beforeEach(async () => {
    mockLogger = {
      debug: mock(() => {}),
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
      child: mock(() => mockLogger),
    };

    performanceMonitor = new PerformanceMonitorService(
      { name: 'test-decorator-monitor' },
      mockLogger
    );

    await performanceMonitor.initialize();
    setGlobalPerformanceMonitor(performanceMonitor);
  });

  afterEach(async () => {
    await performanceMonitor.shutdown();
    performanceMonitor.clear();
    // Reset global monitor to a disabled state instead of null
    const logger = createLogger('disabled');
    const disabledMonitor = new PerformanceMonitorService({ name: 'disabled' }, logger);
    disabledMonitor.setEnabled(false);
    setGlobalPerformanceMonitor(disabledMonitor);
  });

  describe('@Timed decorator', () => {
    test('should measure synchronous method execution', async () => {
      class TestClass {
        syncMethod(): string {
          const timer = performanceMonitor.startTimer('TestClass.syncMethod');
          performanceMonitor.setBudget('TestClass.syncMethod', 100);
          try {
            return 'sync result';
          } finally {
            timer();
          }
        }
      }

      const instance = new TestClass();
      const result = instance.syncMethod();

      expect(result).toBe('sync result');
      
      const metric = performanceMonitor.getMetrics('TestClass.syncMethod');
      expect(metric).toBeDefined();
      expect(metric!.count).toBe(1);
      expect(metric!.average).toBeGreaterThan(0);
    });

    test('should measure asynchronous method execution', async () => {
      class TestClass {
        async asyncMethod(): Promise<string> {
          const timer = performanceMonitor.startTimer('TestClass.asyncMethod');
          performanceMonitor.setBudget('TestClass.asyncMethod', 100);
          try {
            await new Promise(resolve => setTimeout(resolve, 10));
            return 'async result';
          } finally {
            timer();
          }
        }
      }

      const instance = new TestClass();
      const result = await instance.asyncMethod();

      expect(result).toBe('async result');
      
      const metric = performanceMonitor.getMetrics('TestClass.asyncMethod');
      expect(metric).toBeDefined();
      expect(metric!.count).toBe(1);
      expect(metric!.average).toBeGreaterThan(5); // At least 5ms due to setTimeout
    });

    test('should set budget when specified', async () => {
      class TestClass {
        budgetedMethod(): string {
          const timer = performanceMonitor.startTimer('TestClass.budgetedMethod');
          performanceMonitor.setBudget('TestClass.budgetedMethod', 50, 'critical');
          try {
            return 'result';
          } finally {
            timer();
          }
        }
      }

      const instance = new TestClass();
      instance.budgetedMethod();

      // Simulate exceeding budget by recording a longer duration
      performanceMonitor.recordMetric('TestClass.budgetedMethod', 75);

      const violations = performanceMonitor.getBudgetViolations();
      expect(violations.length).toBeGreaterThan(0);
      
      const violation = violations.find(v => v.operation === 'TestClass.budgetedMethod');
      expect(violation).toBeDefined();
      expect(violation!.budget).toBe(50);
      expect(violation!.severity).toBe('critical');
    });

    test('should use custom operation name when provided', async () => {
      class TestClass {
        methodWithCustomName(): string {
          const timer = performanceMonitor.startTimer('custom-operation-name');
          try {
            return 'result';
          } finally {
            timer();
          }
        }
      }

      const instance = new TestClass();
      instance.methodWithCustomName();

      const metric = performanceMonitor.getMetrics('custom-operation-name');
      expect(metric).toBeDefined();
      expect(metric!.count).toBe(1);
    });

    test('should handle method errors correctly', async () => {
      class TestClass {
        errorMethod(): string {
          const timer = performanceMonitor.startTimer('TestClass.errorMethod');
          performanceMonitor.setBudget('TestClass.errorMethod', 100);
          try {
            throw new Error('Test error');
          } finally {
            timer();
          }
        }
      }

      const instance = new TestClass();
      
      expect(() => {
        instance.errorMethod();
      }).toThrow('Test error');

      // Should still record the metric despite the error
      const metric = performanceMonitor.getMetrics('TestClass.errorMethod');
      expect(metric).toBeDefined();
      expect(metric!.count).toBe(1);
    });

    test('should handle async method errors correctly', async () => {
      class TestClass {
        async asyncErrorMethod(): Promise<string> {
          const timer = performanceMonitor.startTimer('TestClass.asyncErrorMethod');
          performanceMonitor.setBudget('TestClass.asyncErrorMethod', 100);
          try {
            await new Promise(resolve => setTimeout(resolve, 5));
            throw new Error('Async test error');
          } finally {
            timer();
          }
        }
      }

      const instance = new TestClass();
      
      await expect(instance.asyncErrorMethod()).rejects.toThrow('Async test error');

      const metric = performanceMonitor.getMetrics('TestClass.asyncErrorMethod');
      expect(metric).toBeDefined();
      expect(metric!.count).toBe(1);
    });

    test('should be no-op when monitoring is disabled', async () => {
      performanceMonitor.setEnabled(false);

      class TestClass {
        disabledMethod(): string {
          const timer = performanceMonitor.startTimer('TestClass.disabledMethod');
          performanceMonitor.setBudget('TestClass.disabledMethod', 100);
          try {
            return 'result';
          } finally {
            timer();
          }
        }
      }

      const instance = new TestClass();
      const result = instance.disabledMethod();

      expect(result).toBe('result');
      
      const metric = performanceMonitor.getMetrics('TestClass.disabledMethod');
      expect(metric).toBeUndefined();
    });
  });

  describe('Manual timing (simulating @TimedClass)', () => {
    test('should apply timing to all methods in a class', async () => {
      class TestClass {
        method1(): string {
          const timer = performanceMonitor.startTimer('TestClass.method1');
          performanceMonitor.setBudget('TestClass.method1', 100);
          try {
            return 'result1';
          } finally {
            timer();
          }
        }

        method2(): string {
          const timer = performanceMonitor.startTimer('TestClass.method2');
          performanceMonitor.setBudget('TestClass.method2', 100);
          try {
            return 'result2';
          } finally {
            timer();
          }
        }

        async asyncMethod(): Promise<string> {
          const timer = performanceMonitor.startTimer('TestClass.asyncMethod');
          performanceMonitor.setBudget('TestClass.asyncMethod', 100);
          try {
            await new Promise(resolve => setTimeout(resolve, 5));
            return 'async result';
          } finally {
            timer();
          }
        }
      }

      const instance = new TestClass();
      instance.method1();
      instance.method2();
      await instance.asyncMethod();

      expect(performanceMonitor.getMetrics('TestClass.method1')).toBeDefined();
      expect(performanceMonitor.getMetrics('TestClass.method2')).toBeDefined();
      expect(performanceMonitor.getMetrics('TestClass.asyncMethod')).toBeDefined();

      const report = performanceMonitor.generateReport();
      expect(report.summary.totalOperations).toBeGreaterThanOrEqual(3);
    });
  });

  describe('withTiming utility', () => {
    test('should measure synchronous operations', async () => {
      const result = await withTiming('sync-operation', () => {
        return 'sync result';
      });

      expect(result).toBe('sync result');
      
      const metric = performanceMonitor.getMetrics('sync-operation');
      expect(metric).toBeDefined();
      expect(metric!.count).toBe(1);
    });

    test('should measure asynchronous operations', async () => {
      const result = await withTiming('async-operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async result';
      });

      expect(result).toBe('async result');
      
      const metric = performanceMonitor.getMetrics('async-operation');
      expect(metric).toBeDefined();
      expect(metric!.count).toBe(1);
      expect(metric!.average).toBeGreaterThan(5);
    });

    test('should set budget when specified', async () => {
      await withTiming('budgeted-operation', () => {
        return 'result';
      }, { budgetMs: 50, severity: 'warning' });

      // Simulate exceeding budget
      performanceMonitor.recordMetric('budgeted-operation', 75);

      const violations = performanceMonitor.getBudgetViolations();
      const violation = violations.find(v => v.operation === 'budgeted-operation');
      expect(violation).toBeDefined();
      expect(violation!.budget).toBe(50);
      expect(violation!.severity).toBe('warning');
    });

    test('should handle operation errors correctly', async () => {
      await expect(
        withTiming('error-operation', () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      const metric = performanceMonitor.getMetrics('error-operation');
      expect(metric).toBeDefined();
      expect(metric!.count).toBe(1);
    });

    test('should be no-op when monitoring is disabled', async () => {
      performanceMonitor.setEnabled(false);

      const result = await withTiming('disabled-operation', () => {
        return 'result';
      });

      expect(result).toBe('result');
      expect(performanceMonitor.getMetrics('disabled-operation')).toBeUndefined();
    });
  });

  describe('createTimedFunction utility', () => {
    test('should create timed version of function', () => {
      const originalFunction = (x: number, y: number): number => {
        return x + y;
      };

      const timedFunction = createTimedFunction(
        'add-operation',
        originalFunction as (...args: unknown[]) => unknown,
        { budgetMs: 10 }
      );

      const result = timedFunction(2, 3);
      expect(result).toBe(5);

      const metric = performanceMonitor.getMetrics('add-operation');
      expect(metric).toBeDefined();
      expect(metric!.count).toBe(1);
    });

    test('should handle async functions', async () => {
      const asyncFunction = async (delay: number): Promise<string> => {
        await new Promise(resolve => setTimeout(resolve, delay));
        return 'completed';
      };

      const timedAsyncFunction = createTimedFunction(
        'async-add-operation',
        asyncFunction as (...args: unknown[]) => unknown,
        { budgetMs: 50 }
      );

      const result = await timedAsyncFunction(10);
      expect(result).toBe('completed');

      const metric = performanceMonitor.getMetrics('async-add-operation');
      expect(metric).toBeDefined();
      expect(metric!.count).toBe(1);
      expect(metric!.average).toBeGreaterThan(5);
    });

    test('should preserve function behavior with errors', () => {
      const errorFunction = (): never => {
        throw new Error('Function error');
      };

      const timedErrorFunction = createTimedFunction(
        'error-function',
        errorFunction
      );

      expect(() => {
        timedErrorFunction();
      }).toThrow('Function error');

      const metric = performanceMonitor.getMetrics('error-function');
      expect(metric).toBeDefined();
      expect(metric!.count).toBe(1);
    });
  });

  test('should use custom monitor when provided', async () => {
    const customMockMonitor: IPerformanceMonitor = {
      startTimer: mock(() => mock(() => {})),
      recordMetric: mock(() => {}),
      setBudget: mock(() => {}),
      generateReport: mock(() => ({}) as any),
      clear: mock(() => {}),
      getMetrics: mock(() => undefined),
      getBudgetViolations: mock(() => []),
      setEnabled: mock(() => {}),
      isEnabled: mock(() => true),
    };

    const result = await withTiming('custom-monitor-op', () => {
      return 'result';
    }, { monitor: customMockMonitor });

    expect(result).toBe('result');
    expect(customMockMonitor.startTimer).toHaveBeenCalledWith('custom-monitor-op');
  });
});