import { describe, expect, test } from 'bun:test';
import { existsSync } from 'fs';
import { join } from 'path';

describe('Performance Benchmark Infrastructure', () => {
  const projectRoot = process.cwd();
  
  test('benchmark workflow should exist', () => {
    const benchmarkWorkflow = join(projectRoot, '.github', 'workflows', 'benchmark.yml');
    expect(existsSync(benchmarkWorkflow)).toBe(true);
  });
  
  test('benchmark scripts should exist', () => {
    const benchmarkScript = join(projectRoot, 'packages', 'core', 'tests', 'benchmarks', 'startup.bench.ts');
    expect(existsSync(benchmarkScript)).toBe(true);
  });
  
  test('comparison script should exist', () => {
    const compareScript = join(projectRoot, 'packages', 'core', 'tests', 'benchmarks', 'compare.ts');
    expect(existsSync(compareScript)).toBe(true);
  });
  
  test('performance directory should exist', () => {
    const perfDir = join(projectRoot, '.performance');
    expect(existsSync(perfDir)).toBe(true);
  });
  
  test('baselines directory should exist', () => {
    const baselinesDir = join(projectRoot, '.performance', 'baselines');
    expect(existsSync(baselinesDir)).toBe(true);
  });
});