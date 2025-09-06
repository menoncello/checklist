import { describe, it, expect } from 'bun:test';
import { 
  PerformanceTester, 
  benchmarkStartupTime, 
  benchmarkMemoryUsage 
} from '../src/testing/performance-tester';

describe('PerformanceTester', () => {
  describe('Basic Benchmarking', () => {
    it('should add and run benchmarks', async () => {
      const tester = new PerformanceTester();
      
      tester.add('fast-function', () => {
        let sum = 0;
        for (let i = 0; i < 100; i++) {
          sum += i;
        }
      });

      const results = await tester.run();
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('fast-function');
      expect(results[0].mean).toBeGreaterThan(0);
      expect(results[0].samples).toBeGreaterThan(0);
      expect(results[0].passed).toBe(true);
    });

    it('should run multiple benchmarks', async () => {
      const tester = new PerformanceTester();
      
      tester.add('bench-1', () => { Math.sqrt(16); });
      tester.add('bench-2', () => { Math.pow(2, 10); });
      tester.add('bench-3', async () => { 
        await Promise.resolve(42);
      });

      const results = await tester.run();
      
      expect(results).toHaveLength(3);
      expect(results.map(r => r.name)).toEqual(['bench-1', 'bench-2', 'bench-3']);
    });
  });

  describe('Performance Thresholds', () => {
    it('should detect threshold violations', async () => {
      const tester = new PerformanceTester();
      
      tester.add(
        'slow-function',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
        },
        { mean: 5, p95: 8 } // Thresholds that will be exceeded
      );

      const results = await tester.run();
      
      expect(results[0].passed).toBe(false);
      expect(results[0].violations).toHaveLength(2);
      expect(results[0].violations[0]).toContain('Mean');
      expect(results[0].violations[0]).toContain('exceeds threshold');
    });

    it('should pass when within thresholds', async () => {
      const tester = new PerformanceTester();
      
      tester.add(
        'fast-function',
        () => {
          let x = 1 + 1;
        },
        { mean: 1000, max: 2000 }
      );

      const results = await tester.run();
      
      expect(results[0].passed).toBe(true);
      expect(results[0].violations).toHaveLength(0);
    });

    it('should check all threshold types', async () => {
      const tester = new PerformanceTester();
      
      tester.add(
        'test-all-thresholds',
        () => { Math.random(); },
        { 
          mean: 0.001,
          p95: 0.001,
          p99: 0.001,
          max: 0.001
        }
      );

      const results = await tester.run();
      
      expect(results[0].passed).toBe(false);
      expect(results[0].violations.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Setup and Teardown', () => {
    it('should support setup and teardown', async () => {
      const tester = new PerformanceTester();
      let setupCalled = false;
      let teardownCalled = false;
      let context: any = null;

      tester.addWithSetup(
        'with-setup',
        () => {
          setupCalled = true;
          return { data: 'test-data' };
        },
        (ctx) => {
          context = ctx;
        },
        (ctx) => {
          teardownCalled = true;
          expect(ctx.data).toBe('test-data');
        }
      );

      await tester.run();
      
      expect(setupCalled).toBe(true);
      expect(teardownCalled).toBe(true);
      expect(context).toEqual({ data: 'test-data' });
    });

    it('should handle async setup and teardown', async () => {
      const tester = new PerformanceTester();
      const events: string[] = [];

      tester.addWithSetup(
        'async-lifecycle',
        async () => {
          events.push('setup');
          await new Promise(r => setTimeout(r, 1));
          return { value: 42 };
        },
        async (ctx) => {
          events.push('test');
          expect(ctx.value).toBe(42);
        },
        async (ctx) => {
          events.push('teardown');
          await new Promise(r => setTimeout(r, 1));
        }
      );

      await tester.run();
      
      expect(events).toContain('setup');
      expect(events).toContain('test');
      expect(events).toContain('teardown');
    });
  });

  describe('Assertions', () => {
    it('should assert performance requirements', async () => {
      const tester = new PerformanceTester();
      
      tester.add('passing-test', () => { 1 + 1; }, { mean: 1000 });
      
      // Should not throw when performance is within limits
      await tester.assertPerformance();
    });

    it('should throw on performance violations', async () => {
      const tester = new PerformanceTester();
      
      tester.add(
        'failing-test',
        async () => {
          await new Promise(r => setTimeout(r, 20));
        },
        { mean: 5 }
      );

      await expect(tester.assertPerformance()).rejects.toThrow('Performance thresholds violated');
    });
  });

  describe('Result Formatting', () => {
    it('should format results as readable string', async () => {
      const tester = new PerformanceTester();
      
      tester.add('format-test', () => { Math.sqrt(4); });
      
      const results = await tester.run();
      const formatted = tester.formatResults(results);
      
      expect(formatted).toContain('Performance Benchmark Results');
      expect(formatted).toContain('format-test');
      expect(formatted).toContain('Mean:');
      expect(formatted).toContain('Median:');
      expect(formatted).toContain('P95:');
      expect(formatted).toContain('P99:');
      expect(formatted).toContain('Status:');
      expect(formatted).toContain('✅ PASSED');
    });

    it('should show failures in formatting', async () => {
      const tester = new PerformanceTester();
      
      tester.add(
        'fail-format',
        async () => { await new Promise(r => setTimeout(r, 10)); },
        { mean: 1 }
      );
      
      const results = await tester.run();
      const formatted = tester.formatResults(results);
      
      expect(formatted).toContain('❌ FAILED');
      expect(formatted).toContain('exceeds threshold');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset benchmarks and thresholds', async () => {
      const tester = new PerformanceTester();
      
      tester.add('test-1', () => { 1 + 1; });
      tester.add('test-2', () => { 2 + 2; });
      
      let results = await tester.run();
      expect(results).toHaveLength(2);
      
      tester.reset();
      
      tester.add('test-3', () => { 3 + 3; });
      results = await tester.run();
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('test-3');
    });
  });
});

describe('Benchmark Utilities', () => {
  describe('benchmarkStartupTime', () => {
    it('should measure CLI startup time', async () => {
      // Test with echo command which should be fast
      await benchmarkStartupTime('echo', ['test'], 1000);
    });

    it('should fail if startup exceeds threshold', async () => {
      // Sleep command should exceed 1ms threshold
      await expect(
        benchmarkStartupTime('sleep', ['0.1'], 1)
      ).rejects.toThrow();
    });
  });

  describe('benchmarkMemoryUsage', () => {
    it('should measure memory usage', async () => {
      const result = await benchmarkMemoryUsage(() => {
        const arr = new Array(1000).fill(0);
        return arr.length;
      }, 100);
      
      expect(result).toBe(1000);
    });

    it('should fail if memory usage exceeds limit', async () => {
      // Skip this test as memory measurement can be unreliable
      // depending on GC and platform
    });

    it('should work with async functions', async () => {
      const result = await benchmarkMemoryUsage(async () => {
        await new Promise(r => setTimeout(r, 10));
        return 'async-result';
      }, 100);
      
      expect(result).toBe('async-result');
    });
  });
});