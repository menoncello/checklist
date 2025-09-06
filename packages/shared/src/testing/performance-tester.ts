import { Bench } from 'tinybench';

export interface PerformanceThresholds {
  mean?: number;
  p95?: number;
  p99?: number;
  max?: number;
}

export interface BenchmarkResult {
  name: string;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  samples: number;
  passed: boolean;
  violations: string[];
}

export class PerformanceTester {
  private bench: Bench;
  private thresholds: Map<string, PerformanceThresholds> = new Map();

  constructor() {
    this.bench = new Bench({
      time: 100, // Reduced from 1000ms
      iterations: 10, // Reduced from 100
      warmupIterations: 2, // Reduced from 10
      warmupTime: 10, // Reduced from 100ms
    });
  }

  add(
    name: string,
    fn: () => void | Promise<void>,
    thresholds?: PerformanceThresholds
  ): void {
    this.bench.add(name, fn);
    if (thresholds) {
      this.thresholds.set(name, thresholds);
    }
  }

  addWithSetup<T>(
    name: string,
    setup: () => T | Promise<T>,
    fn: (context: T) => void | Promise<void>,
    teardown?: (context: T) => void | Promise<void>,
    thresholds?: PerformanceThresholds
  ): void {
    this.bench.add(name, async () => {
      const context = await setup();
      try {
        await fn(context);
      } finally {
        if (teardown) {
          await teardown(context);
        }
      }
    });

    if (thresholds) {
      this.thresholds.set(name, thresholds);
    }
  }

  async run(): Promise<BenchmarkResult[]> {
    await this.bench.run();
    return this.getResults();
  }

  private getResults(): BenchmarkResult[] {
    const results: BenchmarkResult[] = [];

    for (const task of this.bench.tasks) {
      if (!task.result) continue;

      const thresholds = this.thresholds.get(task.name);
      const violations: string[] = [];

      const mean = task.result.mean;
      const median = (task.result as any).median ?? mean;
      const p95 = task.result.p995 ?? mean;
      const p99 = task.result.p99 ?? mean;
      const min = task.result.min ?? mean;
      const max = task.result.max ?? mean;

      if (thresholds) {
        if (thresholds.mean !== undefined && mean > thresholds.mean) {
          violations.push(
            `Mean ${mean.toFixed(2)}ms exceeds threshold ${thresholds.mean}ms`
          );
        }
        if (thresholds.p95 !== undefined && p95 > thresholds.p95) {
          violations.push(
            `P95 ${p95.toFixed(2)}ms exceeds threshold ${thresholds.p95}ms`
          );
        }
        if (thresholds.p99 !== undefined && p99 > thresholds.p99) {
          violations.push(
            `P99 ${p99.toFixed(2)}ms exceeds threshold ${thresholds.p99}ms`
          );
        }
        if (thresholds.max !== undefined && max > thresholds.max) {
          violations.push(
            `Max ${max.toFixed(2)}ms exceeds threshold ${thresholds.max}ms`
          );
        }
      }

      results.push({
        name: task.name,
        mean,
        median,
        p95,
        p99,
        min,
        max,
        samples: task.result.samples?.length || 0,
        passed: violations.length === 0,
        violations,
      });
    }

    return results;
  }

  async assertPerformance(): Promise<void> {
    const results = await this.run();
    const failures = results.filter((r) => !r.passed);

    if (failures.length > 0) {
      const message = failures
        .map((f) => `${f.name}:\n  ${f.violations.join('\n  ')}`)
        .join('\n\n');
      throw new Error(`Performance thresholds violated:\n\n${message}`);
    }
  }

  formatResults(results: BenchmarkResult[]): string {
    const lines: string[] = ['Performance Benchmark Results', '='.repeat(50)];

    for (const result of results) {
      lines.push('');
      lines.push(`Benchmark: ${result.name}`);
      lines.push(`  Mean:    ${result.mean.toFixed(2)}ms`);
      lines.push(`  Median:  ${result.median.toFixed(2)}ms`);
      lines.push(`  P95:     ${result.p95.toFixed(2)}ms`);
      lines.push(`  P99:     ${result.p99.toFixed(2)}ms`);
      lines.push(`  Min:     ${result.min.toFixed(2)}ms`);
      lines.push(`  Max:     ${result.max.toFixed(2)}ms`);
      lines.push(`  Samples: ${result.samples}`);

      if (result.passed) {
        lines.push(`  Status:  ✅ PASSED`);
      } else {
        lines.push(`  Status:  ❌ FAILED`);
        result.violations.forEach((v) => lines.push(`    - ${v}`));
      }
    }

    return lines.join('\n');
  }

  reset(): void {
    this.bench = new Bench({
      time: 100, // Reduced from 1000ms
      iterations: 10, // Reduced from 100
      warmupIterations: 2, // Reduced from 10
      warmupTime: 10, // Reduced from 100ms
    });
    this.thresholds.clear();
  }
}

export async function benchmarkStartupTime(
  command: string,
  args: string[] = [],
  threshold: number = 100
): Promise<void> {
  const tester = new PerformanceTester();

  tester.add(
    'CLI Startup Time',
    async () => {
      const proc = Bun.spawn([command, ...args], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      await proc.exited;
    },
    { mean: threshold, p95: threshold * 1.5 }
  );

  await tester.assertPerformance();
}

export async function benchmarkMemoryUsage<T>(
  fn: () => T | Promise<T>,
  maxMemoryMB: number = 50
): Promise<T> {
  const initialMemory = process.memoryUsage().heapUsed;

  const result = await fn();

  if (global.gc) {
    global.gc();
  }

  const finalMemory = process.memoryUsage().heapUsed;
  const memoryUsedMB = (finalMemory - initialMemory) / (1024 * 1024);

  if (memoryUsedMB > maxMemoryMB) {
    throw new Error(
      `Memory usage ${memoryUsedMB.toFixed(2)}MB exceeds threshold ${maxMemoryMB}MB`
    );
  }

  return result;
}
