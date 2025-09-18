import { bench, group } from 'bun:test';
import { spawn } from 'bun';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { PERFORMANCE_BUDGET } from '../../../../performance.config';

const RESULTS_DIR = '.performance';
const BASELINES_DIR = join(RESULTS_DIR, 'baselines');

// Ensure results directory exists
if (!existsSync(RESULTS_DIR)) {
  mkdirSync(RESULTS_DIR, { recursive: true });
}

if (!existsSync(BASELINES_DIR)) {
  mkdirSync(BASELINES_DIR, { recursive: true });
}

interface BenchmarkResult {
  name: string;
  mean: number;
  min: number;
  max: number;
  stdDev: number;
  iterations: number;
  timestamp: string;
}

const results: BenchmarkResult[] = [];

function saveResult(result: BenchmarkResult) {
  results.push(result);
  const resultsFile = join(RESULTS_DIR, 'startup-results.json');
  writeFileSync(resultsFile, JSON.stringify(results, null, 2));
}

group('Startup Performance', () => {
  bench('CLI Help Command', async () => {
    const start = performance.now();

    const proc = spawn(['bun', 'run', './packages/cli/src/index.ts', '--help'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    await proc.exited;
    const end = performance.now();

    const duration = end - start;

    // Validate against performance budget
    if (duration > PERFORMANCE_BUDGET.startup.max) {
      throw new Error(`Startup time ${duration.toFixed(2)}ms exceeds budget of ${PERFORMANCE_BUDGET.startup.max}ms`);
    }

    return duration;
  }, {
    iterations: 5,
    warmup: 2,
  });

  bench('CLI Version Command', async () => {
    const start = performance.now();

    const proc = spawn(['bun', 'run', './packages/cli/src/index.ts', '--version'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    await proc.exited;
    const end = performance.now();

    const duration = end - start;

    // Validate against performance budget
    if (duration > PERFORMANCE_BUDGET.startup.max) {
      throw new Error(`Startup time ${duration.toFixed(2)}ms exceeds budget of ${PERFORMANCE_BUDGET.startup.max}ms`);
    }

    return duration;
  }, {
    iterations: 5,
    warmup: 2,
  });

  bench('Core Module Import', async () => {
    const start = performance.now();

    // Dynamic import to avoid caching effects
    await import('../../src/index');

    const end = performance.now();

    const duration = end - start;

    // Core module import should be much faster
    const importBudget = PERFORMANCE_BUDGET.startup.target; // 50ms
    if (duration > importBudget) {
      throw new Error(`Module import time ${duration.toFixed(2)}ms exceeds budget of ${importBudget}ms`);
    }

    return duration;
  }, {
    iterations: 10,
    warmup: 3,
  });
});

// Export benchmark results for comparison
export { results };