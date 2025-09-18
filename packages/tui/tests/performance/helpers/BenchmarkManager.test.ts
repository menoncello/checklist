import { test, expect, beforeEach, afterEach, describe } from 'bun:test';
import {
  BenchmarkManager,
  PerformanceBenchmark,
  BenchmarkFilter,
} from '../../../src/performance/helpers/BenchmarkManager';

describe('BenchmarkManager', () => {
  let benchmarkManager: BenchmarkManager;

  beforeEach(() => {
    benchmarkManager = new BenchmarkManager();
  });

  afterEach(() => {
    benchmarkManager.clear();
  });

  describe('constructor', () => {
    test('should create with default buffer size', () => {
      const manager = new BenchmarkManager();
      expect(manager.count()).toBe(0);
    });

    test('should create with custom buffer size', () => {
      const manager = new BenchmarkManager(100);
      expect(manager.count()).toBe(0);
    });
  });

  describe('startBenchmark', () => {
    test('should start a benchmark with default category', () => {
      const benchmarkId = benchmarkManager.startBenchmark('test-benchmark');

      expect(benchmarkId).toMatch(/^bench-\d+-[\d.]+$/);
      expect(benchmarkManager.getActiveCount()).toBe(1);

      const activeBenchmarks = benchmarkManager.getActiveBenchmarks();
      expect(activeBenchmarks).toHaveLength(1);
      expect(activeBenchmarks[0].id).toBe(benchmarkId);
      expect(activeBenchmarks[0].name).toBe('test-benchmark');
      expect(activeBenchmarks[0].category).toBe('general');
      expect(activeBenchmarks[0].startTime).toBeGreaterThan(0);
      expect(activeBenchmarks[0].endTime).toBeUndefined();
      expect(activeBenchmarks[0].duration).toBeUndefined();
      expect(activeBenchmarks[0].metadata).toBeUndefined();
    });

    test('should start a benchmark with custom category', () => {
      const benchmarkId = benchmarkManager.startBenchmark('custom-benchmark', 'custom-category');

      const activeBenchmarks = benchmarkManager.getActiveBenchmarks();
      expect(activeBenchmarks[0].category).toBe('custom-category');
    });

    test('should start a benchmark with metadata', () => {
      const metadata = { userId: 123, feature: 'search' };
      const benchmarkId = benchmarkManager.startBenchmark('meta-benchmark', 'test', metadata);

      const activeBenchmarks = benchmarkManager.getActiveBenchmarks();
      expect(activeBenchmarks[0].metadata).toEqual(metadata);
    });

    test('should generate unique IDs for multiple benchmarks', () => {
      const id1 = benchmarkManager.startBenchmark('bench1');
      const id2 = benchmarkManager.startBenchmark('bench2');
      const id3 = benchmarkManager.startBenchmark('bench3');

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
      expect(benchmarkManager.getActiveCount()).toBe(3);
    });
  });

  describe('endBenchmark', () => {
    test('should end an active benchmark', async () => {
      const benchmarkId = benchmarkManager.startBenchmark('test-benchmark');

      // Small delay to ensure measurable duration
      await new Promise(resolve => setTimeout(resolve, 1));

      const result = benchmarkManager.endBenchmark(benchmarkId);

      expect(result).toBeDefined();
      expect(result!.id).toBe(benchmarkId);
      expect(result!.endTime).toBeGreaterThan(result!.startTime);
      expect(result!.duration).toBeGreaterThan(0);
      expect(result!.duration).toBe(result!.endTime! - result!.startTime);

      expect(benchmarkManager.getActiveCount()).toBe(0);
      expect(benchmarkManager.count()).toBe(1);
    });

    test('should return null for non-existent benchmark', () => {
      const result = benchmarkManager.endBenchmark('invalid-id');
      expect(result).toBeNull();
    });

    test('should move benchmark from active to completed', () => {
      const benchmarkId = benchmarkManager.startBenchmark('test-benchmark');
      expect(benchmarkManager.getActiveCount()).toBe(1);
      expect(benchmarkManager.count()).toBe(0);

      benchmarkManager.endBenchmark(benchmarkId);
      expect(benchmarkManager.getActiveCount()).toBe(0);
      expect(benchmarkManager.count()).toBe(1);
    });

    test('should handle buffer size limit', () => {
      const manager = new BenchmarkManager(2); // Small buffer

      // Create and end 3 benchmarks
      const id1 = manager.startBenchmark('bench1');
      const id2 = manager.startBenchmark('bench2');
      const id3 = manager.startBenchmark('bench3');

      manager.endBenchmark(id1);
      manager.endBenchmark(id2);
      manager.endBenchmark(id3);

      // Should only keep the last 2
      expect(manager.count()).toBe(2);
      const benchmarks = manager.getBenchmarks();
      const names = benchmarks.map(b => b.name);
      expect(names).toContain('bench2');
      expect(names).toContain('bench3');
      expect(names).not.toContain('bench1');
    });
  });

  describe('measureFunction', () => {
    test('should measure synchronous function execution', () => {
      const testFunction = (x: number, y: number) => x + y;
      const measuredFunction = benchmarkManager.measureFunction(testFunction as (...args: unknown[]) => unknown, 'add-function', 'math');

      const result = measuredFunction(2, 3);
      expect(result).toBe(5);

      expect(benchmarkManager.count()).toBe(1);
      const benchmarks = benchmarkManager.getBenchmarks();
      expect(benchmarks[0].name).toBe('add-function');
      expect(benchmarks[0].category).toBe('math');
      expect(benchmarks[0].duration).toBeGreaterThanOrEqual(0);
      expect(benchmarks[0].metadata?.type).toBe('function');
      expect(benchmarks[0].metadata?.functionName).toBe('testFunction');
    });

    test('should measure named function', () => {
      const namedFunction = (x: number) => x * 2;
      const measuredFunction = benchmarkManager.measureFunction(namedFunction as (...args: unknown[]) => unknown, 'double-function');

      measuredFunction(5);

      const benchmarks = benchmarkManager.getBenchmarks();
      expect(benchmarks[0].metadata?.functionName).toBe('namedFunction');
    });

    test('should measure truly anonymous function', () => {
      // Create truly anonymous function by not assigning to variable
      const measuredFunction = benchmarkManager.measureFunction(((x: number) => x * 2) as (...args: unknown[]) => unknown, 'anonymous-function');

      measuredFunction(5);

      const benchmarks = benchmarkManager.getBenchmarks();
      expect(benchmarks[0].metadata?.functionName).toBe('anonymous');
    });

    test('should handle function that throws error', () => {
      const errorFunction = () => {
        throw new Error('Test error');
      };
      const measuredFunction = benchmarkManager.measureFunction(errorFunction, 'error-function');

      expect(() => measuredFunction()).toThrow('Test error');

      expect(benchmarkManager.count()).toBe(1);
      const benchmarks = benchmarkManager.getBenchmarks();
      expect(benchmarks[0].metadata?.error).toBe('Test error');
    });

    test('should handle function with multiple parameters and complex return', () => {
      const complexFunction = (a: number, b: string, c: boolean) => ({
        sum: a + b.length,
        flag: c,
        computed: a * (c ? 1 : 0),
      });

      const measuredFunction = benchmarkManager.measureFunction(complexFunction as (...args: unknown[]) => unknown, 'complex-function');
      const result = measuredFunction(10, 'hello', true);

      expect(result).toEqual({
        sum: 15,
        flag: true,
        computed: 10,
      });

      expect(benchmarkManager.count()).toBe(1);
    });

    test('should preserve function context and this binding', () => {
      class TestClass {
        value = 42;

        getValue(multiplier: number) {
          return this.value * multiplier;
        }
      }

      const instance = new TestClass();
      const measuredGetValue = benchmarkManager.measureFunction(
        instance.getValue.bind(instance) as (...args: unknown[]) => unknown,
        'bound-method'
      );

      const result = measuredGetValue(2);
      expect(result).toBe(84);
    });
  });

  describe('measureAsync', () => {
    test('should measure async promise execution', async () => {
      const asyncOperation = new Promise<string>((resolve) => {
        setTimeout(() => resolve('async result'), 10);
      });

      const result = await benchmarkManager.measureAsync(asyncOperation, 'async-test', 'promises');

      expect(result).toBe('async result');
      expect(benchmarkManager.count()).toBe(1);

      const benchmarks = benchmarkManager.getBenchmarks();
      expect(benchmarks[0].name).toBe('async-test');
      expect(benchmarks[0].category).toBe('promises');
      expect(benchmarks[0].duration).toBeGreaterThan(5); // Should take at least 10ms
      expect(benchmarks[0].metadata?.type).toBe('async');
    });

    test('should handle rejected promises', async () => {
      const rejectedPromise = Promise.reject(new Error('Async error'));

      await expect(
        benchmarkManager.measureAsync(rejectedPromise, 'failed-async')
      ).rejects.toThrow('Async error');

      expect(benchmarkManager.count()).toBe(1);
      const benchmarks = benchmarkManager.getBenchmarks();
      expect(benchmarks[0].metadata?.error).toBe('Async error');
    });

    test('should handle non-Error rejection', async () => {
      const rejectedPromise = Promise.reject('String error');

      await expect(
        benchmarkManager.measureAsync(rejectedPromise, 'string-error-async')
      ).rejects.toBe('String error');

      const benchmarks = benchmarkManager.getBenchmarks();
      expect(benchmarks[0].metadata?.error).toBe('Unknown error');
    });

    test('should measure multiple async operations', async () => {
      const promise1 = Promise.resolve('result1');
      const promise2 = new Promise<string>(resolve => setTimeout(() => resolve('result2'), 5));

      const [result1, result2] = await Promise.all([
        benchmarkManager.measureAsync(promise1, 'fast-async'),
        benchmarkManager.measureAsync(promise2, 'slow-async'),
      ]);

      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
      expect(benchmarkManager.count()).toBe(2);
    });
  });

  describe('getBenchmarks', () => {
    test('should return all benchmarks without filter', () => {
      const id1 = benchmarkManager.startBenchmark('bench1', 'cat1');
      const id2 = benchmarkManager.startBenchmark('bench2', 'cat2');

      benchmarkManager.endBenchmark(id1);
      benchmarkManager.endBenchmark(id2);

      const benchmarks = benchmarkManager.getBenchmarks();
      expect(benchmarks).toHaveLength(2);
    });

    test('should filter by name', () => {
      const id1 = benchmarkManager.startBenchmark('target-bench');
      const id2 = benchmarkManager.startBenchmark('other-bench');

      benchmarkManager.endBenchmark(id1);
      benchmarkManager.endBenchmark(id2);

      const filtered = benchmarkManager.getBenchmarks({ name: 'target-bench' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('target-bench');
    });

    test('should filter by category', () => {
      const id1 = benchmarkManager.startBenchmark('bench1', 'database');
      const id2 = benchmarkManager.startBenchmark('bench2', 'api');
      const id3 = benchmarkManager.startBenchmark('bench3', 'database');

      benchmarkManager.endBenchmark(id1);
      benchmarkManager.endBenchmark(id2);
      benchmarkManager.endBenchmark(id3);

      const filtered = benchmarkManager.getBenchmarks({ category: 'database' });
      expect(filtered).toHaveLength(2);
      filtered.forEach(b => expect(b.category).toBe('database'));
    });

    test('should filter by completed status', () => {
      const id1 = benchmarkManager.startBenchmark('completed-bench');
      const id2 = benchmarkManager.startBenchmark('active-bench');

      benchmarkManager.endBenchmark(id1);
      // id2 remains active

      const completed = benchmarkManager.getBenchmarks({ completed: true });
      expect(completed).toHaveLength(1);
      expect(completed[0].name).toBe('completed-bench');

      const incomplete = benchmarkManager.getBenchmarks({ completed: false });
      expect(incomplete).toHaveLength(0); // Active benchmarks don't appear in getBenchmarks
    });

    test('should filter by time range', () => {
      const startTime = performance.now();

      const id1 = benchmarkManager.startBenchmark('early-bench');
      benchmarkManager.endBenchmark(id1);

      const midTime = performance.now();

      const id2 = benchmarkManager.startBenchmark('late-bench');
      benchmarkManager.endBenchmark(id2);

      const endTime = performance.now();

      const earlyBenchmarks = benchmarkManager.getBenchmarks({
        startTime: startTime,
        endTime: midTime,
      });
      expect(earlyBenchmarks).toHaveLength(1);
      expect(earlyBenchmarks[0].name).toBe('early-bench');

      const laterBenchmarks = benchmarkManager.getBenchmarks({
        startTime: midTime,
      });
      expect(laterBenchmarks).toHaveLength(1);
      expect(laterBenchmarks[0].name).toBe('late-bench');
    });

    test('should apply limit', () => {
      for (let i = 0; i < 5; i++) {
        const id = benchmarkManager.startBenchmark(`bench-${i}`);
        benchmarkManager.endBenchmark(id);
      }

      const limited = benchmarkManager.getBenchmarks({ limit: 3 });
      expect(limited).toHaveLength(3);

      // Should get the last 3 benchmarks
      const names = limited.map(b => b.name);
      expect(names).toContain('bench-2');
      expect(names).toContain('bench-3');
      expect(names).toContain('bench-4');
    });

    test('should combine multiple filters', () => {
      const id1 = benchmarkManager.startBenchmark('test-bench', 'category1');
      const id2 = benchmarkManager.startBenchmark('other-bench', 'category1');
      const id3 = benchmarkManager.startBenchmark('test-bench', 'category2');

      benchmarkManager.endBenchmark(id1);
      benchmarkManager.endBenchmark(id2);
      benchmarkManager.endBenchmark(id3);

      const filtered = benchmarkManager.getBenchmarks({
        name: 'test-bench',
        category: 'category1',
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('test-bench');
      expect(filtered[0].category).toBe('category1');
    });
  });

  describe('getActiveBenchmarks', () => {
    test('should return only active benchmarks', () => {
      const id1 = benchmarkManager.startBenchmark('active1');
      const id2 = benchmarkManager.startBenchmark('active2');
      const id3 = benchmarkManager.startBenchmark('to-complete');

      benchmarkManager.endBenchmark(id3);

      const activeBenchmarks = benchmarkManager.getActiveBenchmarks();
      expect(activeBenchmarks).toHaveLength(2);

      const activeIds = activeBenchmarks.map(b => b.id);
      expect(activeIds).toContain(id1);
      expect(activeIds).toContain(id2);
      expect(activeIds).not.toContain(id3);
    });

    test('should return empty array when no active benchmarks', () => {
      const id1 = benchmarkManager.startBenchmark('bench1');
      const id2 = benchmarkManager.startBenchmark('bench2');

      benchmarkManager.endBenchmark(id1);
      benchmarkManager.endBenchmark(id2);

      const activeBenchmarks = benchmarkManager.getActiveBenchmarks();
      expect(activeBenchmarks).toEqual([]);
    });
  });

  describe('cancelBenchmark', () => {
    test('should cancel an active benchmark', () => {
      const benchmarkId = benchmarkManager.startBenchmark('cancel-test');
      expect(benchmarkManager.getActiveCount()).toBe(1);

      const result = benchmarkManager.cancelBenchmark(benchmarkId);
      expect(result).toBe(true);
      expect(benchmarkManager.getActiveCount()).toBe(0);
      expect(benchmarkManager.count()).toBe(0); // Should not be added to completed benchmarks
    });

    test('should return false for non-existent benchmark', () => {
      const result = benchmarkManager.cancelBenchmark('invalid-id');
      expect(result).toBe(false);
    });

    test('should not affect completed benchmarks', () => {
      const id1 = benchmarkManager.startBenchmark('to-complete');
      const id2 = benchmarkManager.startBenchmark('to-cancel');

      benchmarkManager.endBenchmark(id1);

      const result = benchmarkManager.cancelBenchmark(id1); // Try to cancel completed benchmark
      expect(result).toBe(false);
      expect(benchmarkManager.count()).toBe(1); // Should still have the completed benchmark
    });
  });

  describe('clear', () => {
    test('should clear all benchmarks and active benchmarks', () => {
      const id1 = benchmarkManager.startBenchmark('active-bench');
      const id2 = benchmarkManager.startBenchmark('completed-bench');

      benchmarkManager.endBenchmark(id2);

      expect(benchmarkManager.count()).toBe(1);
      expect(benchmarkManager.getActiveCount()).toBe(1);

      benchmarkManager.clear();

      expect(benchmarkManager.count()).toBe(0);
      expect(benchmarkManager.getActiveCount()).toBe(0);
      expect(benchmarkManager.getBenchmarks()).toEqual([]);
      expect(benchmarkManager.getActiveBenchmarks()).toEqual([]);
    });
  });

  describe('count and getActiveCount', () => {
    test('should track counts correctly', () => {
      expect(benchmarkManager.count()).toBe(0);
      expect(benchmarkManager.getActiveCount()).toBe(0);

      const id1 = benchmarkManager.startBenchmark('bench1');
      expect(benchmarkManager.count()).toBe(0);
      expect(benchmarkManager.getActiveCount()).toBe(1);

      const id2 = benchmarkManager.startBenchmark('bench2');
      expect(benchmarkManager.count()).toBe(0);
      expect(benchmarkManager.getActiveCount()).toBe(2);

      benchmarkManager.endBenchmark(id1);
      expect(benchmarkManager.count()).toBe(1);
      expect(benchmarkManager.getActiveCount()).toBe(1);

      benchmarkManager.cancelBenchmark(id2);
      expect(benchmarkManager.count()).toBe(1);
      expect(benchmarkManager.getActiveCount()).toBe(0);
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle rapid start and end operations', async () => {
      const operations = [];

      // Start multiple benchmarks rapidly
      for (let i = 0; i < 10; i++) {
        const id = benchmarkManager.startBenchmark(`rapid-${i}`);
        operations.push(id);
      }

      // End them all
      for (const id of operations) {
        benchmarkManager.endBenchmark(id);
      }

      expect(benchmarkManager.count()).toBe(10);
      expect(benchmarkManager.getActiveCount()).toBe(0);
    });

    test('should handle benchmarks with same names', () => {
      const id1 = benchmarkManager.startBenchmark('duplicate-name');
      const id2 = benchmarkManager.startBenchmark('duplicate-name');

      benchmarkManager.endBenchmark(id1);
      benchmarkManager.endBenchmark(id2);

      const benchmarks = benchmarkManager.getBenchmarks({ name: 'duplicate-name' });
      expect(benchmarks).toHaveLength(2);
      expect(benchmarks[0].id).not.toBe(benchmarks[1].id);
    });

    test('should handle complex metadata objects', () => {
      const complexMetadata = {
        user: { id: 123, name: 'test' },
        settings: { theme: 'dark', lang: 'en' },
        metrics: [1, 2, 3, 4, 5],
        nested: { deep: { value: true } },
      };

      const id = benchmarkManager.startBenchmark('complex-meta', 'test', complexMetadata);
      benchmarkManager.endBenchmark(id);

      const benchmarks = benchmarkManager.getBenchmarks();
      expect(benchmarks[0].metadata).toEqual(complexMetadata);
    });

    test('should handle very short duration benchmarks', () => {
      const id = benchmarkManager.startBenchmark('instant');
      const result = benchmarkManager.endBenchmark(id);

      expect(result).toBeDefined();
      expect(result!.duration).toBeGreaterThanOrEqual(0);
      expect(result!.endTime).toBeGreaterThanOrEqual(result!.startTime);
    });

    test('should maintain benchmark order in completed list', () => {
      const ids = [];

      for (let i = 0; i < 5; i++) {
        const id = benchmarkManager.startBenchmark(`ordered-${i}`);
        ids.push(id);
      }

      // End in reverse order
      for (let i = ids.length - 1; i >= 0; i--) {
        benchmarkManager.endBenchmark(ids[i]);
      }

      const benchmarks = benchmarkManager.getBenchmarks();
      expect(benchmarks).toHaveLength(5);

      // Should be in the order they were completed
      expect(benchmarks[0].name).toBe('ordered-4');
      expect(benchmarks[4].name).toBe('ordered-0');
    });
  });

  describe('performance and scalability', () => {
    test('should handle large number of benchmarks efficiently', () => {
      const startTime = performance.now();

      // Create 1000 benchmarks
      const ids = [];
      for (let i = 0; i < 1000; i++) {
        const id = benchmarkManager.startBenchmark(`perf-test-${i}`, 'performance');
        ids.push(id);
      }

      // End all benchmarks
      for (const id of ids) {
        benchmarkManager.endBenchmark(id);
      }

      const endTime = performance.now();
      const operationTime = endTime - startTime;

      expect(operationTime).toBeLessThan(1000); // Should complete in less than 1 second
      expect(benchmarkManager.count()).toBe(1000);
    });

    test('should handle filtering on large datasets efficiently', () => {
      // Create benchmarks with various categories
      for (let i = 0; i < 100; i++) {
        const category = i % 10 === 0 ? 'special' : 'normal';
        const id = benchmarkManager.startBenchmark(`bench-${i}`, category);
        benchmarkManager.endBenchmark(id);
      }

      const startTime = performance.now();
      const filtered = benchmarkManager.getBenchmarks({ category: 'special' });
      const endTime = performance.now();

      expect(filtered).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });
  });
});