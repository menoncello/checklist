import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import {
  profile,
  setPerformanceMonitor,
  getProfileStats,
  clearProfileResults,
  type ProfileOptions,
} from '../../src/performance/ProfileDecorator';
import { PerformanceMonitor } from '../../src/performance/PerformanceMonitor';

describe('ProfileDecorator', () => {
  let mockPerformanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    clearProfileResults();
    mockPerformanceMonitor = {
      recordMetricValue: mock(() => {}),
    } as any;
    setPerformanceMonitor(mockPerformanceMonitor);
  });

  afterEach(() => {
    clearProfileResults();
  });

  describe('@profile decorator', () => {
    test('should profile synchronous methods', () => {
      class TestClass {
        @profile()
        syncMethod(value: string): string {
          return `processed: ${value}`;
        }
      }

      const instance = new TestClass();
      const result = instance.syncMethod('test');

      expect(result).toBe('processed: test');

      const stats = getProfileStats();
      expect(stats.totalCalls).toBe(1);
      expect(stats.averageDuration).toBeGreaterThan(0);
    });

    test('should profile asynchronous methods', async () => {
      class TestClass {
        @profile()
        async asyncMethod(value: string): Promise<string> {
          await new Promise(resolve => setTimeout(resolve, 10));
          return `async processed: ${value}`;
        }
      }

      const instance = new TestClass();
      const result = await instance.asyncMethod('test');

      expect(result).toBe('async processed: test');

      const stats = getProfileStats();
      expect(stats.totalCalls).toBe(1);
      expect(stats.averageDuration).toBeGreaterThan(5);
    });

    test('should handle method errors gracefully', () => {
      class TestClass {
        @profile()
        errorMethod(): string {
          throw new Error('Test error');
        }
      }

      const instance = new TestClass();
      expect(() => instance.errorMethod()).toThrow('Test error');

      const stats = getProfileStats();
      expect(stats.totalCalls).toBe(1);
    });

    test('should handle async method errors gracefully', async () => {
      class TestClass {
        @profile()
        async asyncErrorMethod(): Promise<string> {
          await new Promise(resolve => setTimeout(resolve, 5));
          throw new Error('Async test error');
        }
      }

      const instance = new TestClass();
      await expect(instance.asyncErrorMethod()).rejects.toThrow('Async test error');

      const stats = getProfileStats();
      expect(stats.totalCalls).toBe(1);
    });

    test('should use custom profile options', () => {
      const options: ProfileOptions = {
        name: 'CustomMethod',
        threshold: 5,
        enableStack: true,
        track: true,
      };

      class TestClass {
        @profile(options)
        customMethod(input: number): number {
          return input * 2;
        }
      }

      const instance = new TestClass();
      const result = instance.customMethod(5);

      expect(result).toBe(10);

      const stats = getProfileStats();
      expect(stats.totalCalls).toBe(1);
    });

    test('should track operations with performance monitor', () => {
      class TestClass {
        @profile({ threshold: 0 })
        trackedMethod(): string {
          return 'done';
        }
      }

      const instance = new TestClass();
      instance.trackedMethod();

      expect(mockPerformanceMonitor.recordMetricValue).toHaveBeenCalled();
    });

    test('should collect profile stats when enabled', () => {
      class TestClass {
        @profile({ enableStack: true, threshold: 1000 }) // High threshold
        stackMethod(): string {
          return 'done';
        }
      }

      const instance = new TestClass();
      instance.stackMethod();

      const results = getProfileStats();
      expect(results.totalCalls).toBe(1);
    });

    test('should log to console when logToConsole is enabled', () => {
      const consoleSpy = mock(() => {});
      const originalLog = console.log;
      console.log = consoleSpy;

      try {
        class TestClass {
          @profile({ logToConsole: true })
          loggedMethod(): string {
            return 'logged';
          }
        }

        const instance = new TestClass();
        instance.loggedMethod();

        expect(consoleSpy).toHaveBeenCalled();
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('profile stats management', () => {
    test('should accumulate profile results', () => {
      class TestClass {
        @profile()
        method1(): void {}

        @profile()
        method2(): void {}
      }

      const instance = new TestClass();
      instance.method1();
      instance.method2();
      instance.method1();

      const stats = getProfileStats();
      expect(stats.totalCalls).toBe(3);
    });

    test('should calculate correct statistics', () => {
      class TestClass {
        @profile()
        fastMethod(): void {
          // Very fast method
        }

        @profile()
        mediumMethod(): void {
          const start = performance.now();
          while (performance.now() - start < 3) {
            // Busy wait for ~3ms
          }
        }

        @profile()
        slowMethod(): void {
          const start = performance.now();
          while (performance.now() - start < 60) {
            // Busy wait for ~60ms to make it a slow operation
          }
        }
      }

      const instance = new TestClass();
      instance.fastMethod();
      instance.mediumMethod();
      instance.slowMethod();

      const stats = getProfileStats();
      expect(stats.totalCalls).toBe(3);
      expect(stats.maxDuration).toBeGreaterThan(stats.minDuration);
      expect(stats.slowOperations.length).toBeGreaterThan(0);
      expect(stats.averageDuration).toBeGreaterThan(0);
    });

    test('should clear profile results', () => {
      class TestClass {
        @profile()
        testMethod(): void {}
      }

      const instance = new TestClass();
      instance.testMethod();

      expect(getProfileStats().totalCalls).toBe(1);

      clearProfileResults();

      const stats = getProfileStats();
      expect(stats.totalCalls).toBe(0);
      expect(stats.slowOperations.length).toBe(0);
    });

    test('should limit stored results to prevent memory leaks', () => {
      class TestClass {
        @profile()
        method(): void {}
      }

      const instance = new TestClass();

      // Call method more than 1000 times (the limit)
      for (let i = 0; i < 1100; i++) {
        instance.method();
      }

      const stats = getProfileStats();
      // Should be limited to 1000 results
      expect(stats.totalCalls).toBe(1000);
    });

    test('should handle empty stats gracefully', () => {
      clearProfileResults();

      const stats = getProfileStats();
      expect(stats.totalCalls).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.maxDuration).toBe(0);
      expect(stats.minDuration).toBe(0);
      expect(stats.slowOperations).toEqual([]);
    });
  });

  describe('performance monitor integration', () => {
    test('should work without performance monitor set', () => {
      setPerformanceMonitor(null as any);

      class TestClass {
        @profile()
        method(): string {
          return 'test';
        }
      }

      const instance = new TestClass();
      const result = instance.method();

      expect(result).toBe('test');
      expect(getProfileStats().totalCalls).toBe(1);
    });

    test('should track metrics when performance monitor is available', () => {
      class TestClass {
        @profile()
        trackedMethod(): void {}
      }

      const instance = new TestClass();
      instance.trackedMethod();

      expect(mockPerformanceMonitor.recordMetricValue).toHaveBeenCalledWith(
        'method_duration',
        expect.any(Number),
        { unit: 'ms' },
        expect.objectContaining({
          name: expect.stringContaining('trackedMethod'),
          timestamp: expect.any(Number),
        })
      );
    });
  });

  describe('method name generation', () => {
    test('should generate default method names', () => {
      class MyTestClass {
        @profile()
        someMethod(): void {}
      }

      const instance = new MyTestClass();
      instance.someMethod();

      const stats = getProfileStats();
      // Should include class name and method name
      expect(stats.totalCalls).toBe(1);
    });

    test('should use custom names when provided', () => {
      class TestClass {
        @profile({ name: 'CustomMethodName' })
        method(): void {}
      }

      const instance = new TestClass();
      instance.method();

      const stats = getProfileStats();
      expect(stats.totalCalls).toBe(1);
    });
  });
});