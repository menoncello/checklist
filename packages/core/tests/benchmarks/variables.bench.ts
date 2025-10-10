/**
 * Variable System Performance Benchmarks
 *
 * Performance targets from Story 3.3:
 * - Variable lookup: <1ms per operation
 * - Scope resolution: <1ms per lookup
 * - Computed variable evaluation: <5ms for simple expressions
 * - Variable persistence: <10ms for state save
 */

import { describe, test, beforeAll, afterAll, expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PerformanceMonitorService } from '../../src/monitoring/PerformanceMonitor';
import { VariableStore } from '../../src/variables/VariableStore';
import { VariableScopeManager } from '../../src/variables/VariableScopeManager';
import { VariableValidator } from '../../src/variables/VariableValidator';
import { ComputedVariableEngine } from '../../src/variables/ComputedVariableEngine';
import { EnvironmentVariableResolver } from '../../src/variables/EnvironmentVariableResolver';
import type { VariableDefinition, VariableValue } from '../../src/variables/types';
import { createLogger } from '../../src/utils/logger';

describe('Variable System Benchmarks', () => {
  let performanceMonitor: PerformanceMonitorService;
  let tempDir: string;
  let store: VariableStore;
  let scopeManager: VariableScopeManager;
  let validator: VariableValidator;
  let computedEngine: ComputedVariableEngine;
  let envResolver: EnvironmentVariableResolver;

  beforeAll(() => {
    const logger = createLogger('benchmark:variables');
    performanceMonitor = new PerformanceMonitorService(
      { name: 'variable-benchmark-monitor' },
      logger
    );

    tempDir = mkdtempSync(join(tmpdir(), 'var-bench-'));
    const stateFile = join(tempDir, 'bench-state.yaml');
    store = new VariableStore(stateFile);
    scopeManager = new VariableScopeManager(store);
    validator = new VariableValidator();
    computedEngine = new ComputedVariableEngine();
    envResolver = new EnvironmentVariableResolver();

    // Set up test environment variables
    Bun.env.HOME = '/home/benchuser';
    Bun.env.USER = 'benchuser';
    Bun.env.PATH = '/usr/local/bin:/usr/bin:/bin';
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ===== Variable Lookup Benchmarks (Target: <1ms) =====

  test('VariableStore.get benchmark - global scope', () => {
    // Setup test data
    for (let i = 0; i < 100; i++) {
      store.set(`var${i}`, `value${i}`);
    }

    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      store.get(`var${i % 100}`);
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    console.log(`VariableStore.get (global): ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);
    console.log(`  Budget: <1ms, Actual: ${avgDuration.toFixed(4)}ms`);

    expect(avgDuration).toBeLessThan(1);
  });

  test('VariableStore.get benchmark - step scope', () => {
    // Setup test data
    for (let i = 0; i < 100; i++) {
      store.set(`stepVar${i}`, `value${i}`, 'step1');
    }

    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      store.get(`stepVar${i % 100}`, 'step1');
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    console.log(`VariableStore.get (step): ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);
    console.log(`  Budget: <1ms, Actual: ${avgDuration.toFixed(4)}ms`);

    expect(avgDuration).toBeLessThan(1);
  });

  test('VariableStore.has benchmark', () => {
    // Setup test data
    for (let i = 0; i < 100; i++) {
      store.set(`checkVar${i}`, `value${i}`);
    }

    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      store.has(`checkVar${i % 100}`);
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    console.log(`VariableStore.has: ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);
    console.log(`  Budget: <1ms, Actual: ${avgDuration.toFixed(4)}ms`);

    expect(avgDuration).toBeLessThan(1);
  });

  // ===== Scope Resolution Benchmarks (Target: <1ms) =====

  test('VariableScopeManager.resolve benchmark - global only', () => {
    // Setup test data
    for (let i = 0; i < 50; i++) {
      scopeManager.setGlobal(`global${i}`, `value${i}`);
    }

    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      scopeManager.resolve(`global${i % 50}`);
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    console.log(`VariableScopeManager.resolve (global): ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);
    console.log(`  Budget: <1ms, Actual: ${avgDuration.toFixed(4)}ms`);

    expect(avgDuration).toBeLessThan(1);
  });

  test('VariableScopeManager.resolve benchmark - step with fallback', () => {
    // Setup test data
    for (let i = 0; i < 50; i++) {
      scopeManager.setGlobal(`fallback${i}`, `global-value${i}`);
    }

    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      scopeManager.resolve(`fallback${i % 50}`, 'step1');
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    console.log(`VariableScopeManager.resolve (step+fallback): ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);
    console.log(`  Budget: <1ms, Actual: ${avgDuration.toFixed(4)}ms`);

    expect(avgDuration).toBeLessThan(1);
  });

  test('VariableScopeManager.resolveAll benchmark - 3-level hierarchy', () => {
    // Setup 3-level hierarchy
    scopeManager.setGlobal('global1', 'g-value1');
    scopeManager.setGlobal('global2', 'g-value2');
    scopeManager.setStep('parent', 'parent1', 'p-value1');
    scopeManager.setParentStep('child', 'parent');
    scopeManager.setStep('child', 'child1', 'c-value1');

    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      scopeManager.resolveAll('child');
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    console.log(`VariableScopeManager.resolveAll (3-level): ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);
    console.log(`  Budget: <1ms, Actual: ${avgDuration.toFixed(4)}ms`);

    expect(avgDuration).toBeLessThan(1);
  });

  // ===== Validation Benchmarks =====

  test('VariableValidator.validate benchmark - string type', () => {
    const stringDef: VariableDefinition = {
      name: 'testString',
      type: 'string',
      required: false,
      description: 'Test string',
    };

    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      validator.validate(`value${i}`, stringDef);
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    console.log(`VariableValidator.validate (string): ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);

    expect(avgDuration).toBeLessThan(0.1);
  });

  test('VariableValidator.validate benchmark - with pattern', () => {
    const patternDef: VariableDefinition = {
      name: 'email',
      type: 'string',
      required: false,
      description: 'Email',
      validation: {
        pattern: '^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$',
      },
    };

    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      validator.validate('user@example.com', patternDef);
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    console.log(`VariableValidator.validate (pattern): ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);

    expect(avgDuration).toBeLessThan(0.5);
  });

  test('VariableValidator.validate benchmark - number with min/max', () => {
    const numberDef: VariableDefinition = {
      name: 'age',
      type: 'number',
      required: false,
      description: 'Age',
      validation: {
        min: 0,
        max: 150,
      },
    };

    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      validator.validate(25, numberDef);
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    console.log(`VariableValidator.validate (number+min/max): ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);

    expect(avgDuration).toBeLessThan(0.1);
  });

  // ===== Computed Variable Benchmarks (Target: <5ms) =====

  test('ComputedVariableEngine.evaluate benchmark - simple substitution', async () => {
    const variables = new Map<string, VariableValue>();
    variables.set('name', 'test-project');

    const computedDef: VariableDefinition = {
      name: 'projectName',
      type: 'string',
      required: false,
      description: 'Project name',
      computed: {
        expression: '${name}',
        dependencies: ['name'],
      },
    };

    const getVariable = (name: string) => variables.get(name);

    const iterations = 100;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      await computedEngine.evaluate(computedDef, getVariable);
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    console.log(`ComputedVariableEngine.evaluate (simple): ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);
    console.log(`  Budget: <5ms, Actual: ${avgDuration.toFixed(4)}ms`);

    // First call is uncached, subsequent are cached
    expect(avgDuration).toBeLessThan(5);
  });

  test('ComputedVariableEngine.evaluate benchmark - multiple dependencies', async () => {
    const variables = new Map<string, VariableValue>();
    variables.set('protocol', 'https');
    variables.set('host', 'localhost');
    variables.set('port', 8080);

    const computedDef: VariableDefinition = {
      name: 'url',
      type: 'string',
      required: false,
      description: 'Full URL',
      computed: {
        expression: '${protocol}://${host}:${port}',
        dependencies: ['protocol', 'host', 'port'],
      },
    };

    const getVariable = (name: string) => variables.get(name);

    // Clear cache before benchmark
    computedEngine.clearCache();

    const iterations = 100;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      computedEngine.invalidate('url'); // Force re-evaluation
      await computedEngine.evaluate(computedDef, getVariable);
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    console.log(`ComputedVariableEngine.evaluate (multi-dep, uncached): ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);
    console.log(`  Budget: <5ms, Actual: ${avgDuration.toFixed(4)}ms`);

    expect(avgDuration).toBeLessThan(5);
  });

  test('ComputedVariableEngine.evaluate benchmark - cached performance', async () => {
    const variables = new Map<string, VariableValue>();
    variables.set('base', 'value');

    const computedDef: VariableDefinition = {
      name: 'cached',
      type: 'string',
      required: false,
      description: 'Cached variable',
      computed: {
        expression: '${base}',
        dependencies: ['base'],
      },
    };

    const getVariable = (name: string) => variables.get(name);

    // Prime the cache
    await computedEngine.evaluate(computedDef, getVariable);

    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      await computedEngine.evaluate(computedDef, getVariable);
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    console.log(`ComputedVariableEngine.evaluate (cached): ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);
    console.log(`  Note: Cache hits should be extremely fast (<0.1ms)`);

    expect(avgDuration).toBeLessThan(0.1);
  });

  // ===== Environment Variable Resolution Benchmarks =====

  test('EnvironmentVariableResolver.resolve benchmark', () => {
    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      envResolver.resolve('HOME');
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    console.log(`EnvironmentVariableResolver.resolve: ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);

    expect(avgDuration).toBeLessThan(0.1);
  });

  test('EnvironmentVariableResolver.resolve benchmark - with $ENV: prefix', () => {
    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      envResolver.resolve('$ENV:USER');
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    console.log(`EnvironmentVariableResolver.resolve ($ENV:): ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);

    expect(avgDuration).toBeLessThan(0.1);
  });

  test('EnvironmentVariableResolver.resolveMultiple benchmark', () => {
    const envVars = ['HOME', 'USER', 'PATH'];

    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      envResolver.resolveMultiple(envVars);
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    console.log(`EnvironmentVariableResolver.resolveMultiple (3 vars): ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);

    expect(avgDuration).toBeLessThan(1);
  });

  // ===== Persistence Benchmarks (Target: <10ms) =====

  test('VariableStore.persist benchmark - small dataset', async () => {
    const tempStore = new VariableStore(join(tempDir, 'small-bench.yaml'));

    // Setup small dataset (10 variables)
    for (let i = 0; i < 10; i++) {
      tempStore.set(`var${i}`, `value${i}`);
    }

    const iterations = 100;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      await tempStore.persist();
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    console.log(`VariableStore.persist (10 vars): ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);
    console.log(`  Budget: <10ms, Actual: ${avgDuration.toFixed(4)}ms`);

    expect(avgDuration).toBeLessThan(10);
  });

  test('VariableStore.persist benchmark - medium dataset', async () => {
    const tempStore = new VariableStore(join(tempDir, 'medium-bench.yaml'));

    // Setup medium dataset (100 variables)
    for (let i = 0; i < 100; i++) {
      tempStore.set(`var${i}`, `value${i}`);
      if (i % 10 === 0) {
        tempStore.set(`stepVar${i}`, `stepValue${i}`, `step${i / 10}`);
      }
    }

    const iterations = 100;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      await tempStore.persist();
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    console.log(`VariableStore.persist (100 vars): ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);
    console.log(`  Budget: <10ms, Actual: ${avgDuration.toFixed(4)}ms`);

    expect(avgDuration).toBeLessThan(10);
  });

  test('VariableStore.load benchmark - medium dataset', async () => {
    const tempStore = new VariableStore(join(tempDir, 'load-bench.yaml'));

    // Create dataset and persist
    for (let i = 0; i < 100; i++) {
      tempStore.set(`var${i}`, `value${i}`);
    }
    await tempStore.persist();

    const iterations = 100;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const freshStore = new VariableStore(join(tempDir, 'load-bench.yaml'));
      await freshStore.load();
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    console.log(`VariableStore.load (100 vars): ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);
    console.log(`  Note: Load operations should be fast with Bun.file()`);

    expect(avgDuration).toBeLessThan(10);
  });

  // ===== End-to-End Workflow Benchmarks =====

  test('Complete variable resolution workflow benchmark', async () => {
    const workflowStore = new VariableStore(join(tempDir, 'workflow-bench.yaml'));
    const workflowScope = new VariableScopeManager(workflowStore);
    const workflowValidator = new VariableValidator();

    // Setup workflow: define → validate → store → resolve
    const variableDefs: VariableDefinition[] = [
      {
        name: 'projectName',
        type: 'string',
        required: true,
        description: 'Project name',
        validation: { pattern: '^[a-z0-9-]+$' },
      },
      {
        name: 'port',
        type: 'number',
        required: false,
        description: 'Port number',
        validation: { min: 1024, max: 65535 },
      },
      {
        name: 'enabled',
        type: 'boolean',
        required: false,
        description: 'Feature enabled',
      },
    ];

    const values = {
      projectName: 'my-project',
      port: 3000,
      enabled: true,
    };

    const iterations = 100;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      // Validate all variables
      for (const def of variableDefs) {
        workflowValidator.validate(values[def.name as keyof typeof values], def);
      }

      // Store in scope
      for (const def of variableDefs) {
        workflowScope.setGlobal(def.name, values[def.name as keyof typeof values]);
      }

      // Resolve all
      const resolved = workflowScope.resolveAll();

      // Verify we got all values
      expect(resolved.projectName).toBe('my-project');
    }

    const duration = performance.now() - start;
    const avgDuration = duration / iterations;

    console.log(`Complete workflow (validate+store+resolve): ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);
    console.log(`  Note: Full lifecycle with 3 variables`);

    expect(avgDuration).toBeLessThan(1);
  });

  // ===== Summary Report =====

  test('Variable system performance summary', () => {
    console.log('\n========== Variable System Performance Summary ==========');
    console.log('Target budgets from Story 3.3:');
    console.log('  - Variable lookup: <1ms per operation');
    console.log('  - Scope resolution: <1ms per lookup');
    console.log('  - Computed evaluation: <5ms for simple expressions');
    console.log('  - Variable persistence: <10ms for state save');
    console.log('=========================================================\n');

    expect(true).toBe(true);
  });
});
