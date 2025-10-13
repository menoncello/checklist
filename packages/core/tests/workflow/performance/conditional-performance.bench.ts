/**
 * Performance benchmarks for conditional evaluation
 * Story 3.6: Conditional Workflow Branching (Task 7)
 *
 * Target Performance:
 * - 10 conditions: <10ms
 * - 100 conditions: <100ms (CRITICAL)
 * - 1000 conditions: <500ms
 * - Cache hit rate: >90%
 */

import { Bench } from 'tinybench';
import { ConditionalEvaluationEngine } from '../../../src/workflow/ConditionalEvaluationEngine';
import type { TemplateSandbox } from '../../../src/templates/TemplateSandbox';
import type { VariableStore } from '../../../src/variables/VariableStore';
import type {
  Step,
  ConditionalEvaluationContext,
} from '../../../src/workflow/types';

const bench = new Bench({ time: 1000 });

/**
 * Create mock TemplateSandbox for testing
 */
function createMockSandbox(): TemplateSandbox {
  return {
    evaluateCondition: async (condition: string) => {
      return condition.includes('>') ? true : Math.random() > 0.5;
    },
  } as unknown as TemplateSandbox;
}

/**
 * Create mock VariableStore for testing
 */
function createMockVariableStore(): VariableStore {
  return {
    getAll: () => ({
      count: 15,
      status: 'active',
      enabled: true,
      priority: 'high',
    }),
    get: (name: string) => {
      const vars: Record<string, unknown> = {
        count: 15,
        status: 'active',
        enabled: true,
        priority: 'high',
      };
      return vars[name];
    },
  } as unknown as VariableStore;
}

/**
 * Generate test steps with conditions
 */
function generateSteps(count: number): Step[] {
  const steps: Step[] = [];
  const conditions = [
    'count > 10',
    "status === 'active'",
    'enabled === true',
    "priority === 'high'",
    'count > 5 && enabled === true',
    "count > 10 || priority === 'high'",
    '!enabled',
    'count >= 10 && count <= 20',
  ];

  for (let i = 0; i < count; i++) {
    steps.push({
      id: `step${i + 1}`,
      title: `Step ${i + 1}`,
      condition: conditions[i % conditions.length],
    });
  }

  return steps;
}

/**
 * Create evaluation context
 */
function createContext(): ConditionalEvaluationContext {
  return {
    variables: {
      count: 15,
      status: 'active',
      enabled: true,
      priority: 'high',
    },
    workflowState: {} as any,
    timestamp: Date.now(),
  };
}

/**
 * Benchmark: 10 conditions evaluation
 */
bench.add('10 conditions (target: <10ms)', async () => {
  const engine = new ConditionalEvaluationEngine(
    createMockSandbox(),
    createMockVariableStore()
  );
  const steps = generateSteps(10);
  const context = createContext();

  for (const step of steps) {
    await engine.evaluateStepCondition(step, context);
  }
});

/**
 * Benchmark: 100 conditions evaluation (CRITICAL)
 */
bench.add('100 conditions (target: <100ms) CRITICAL', async () => {
  const engine = new ConditionalEvaluationEngine(
    createMockSandbox(),
    createMockVariableStore()
  );
  const steps = generateSteps(100);
  const context = createContext();

  await Promise.all(
    steps.map((step) => engine.evaluateStepCondition(step, context))
  );
});

/**
 * Benchmark: 1000 conditions evaluation
 */
bench.add('1000 conditions (target: <500ms)', async () => {
  const engine = new ConditionalEvaluationEngine(
    createMockSandbox(),
    createMockVariableStore()
  );
  const steps = generateSteps(1000);
  const context = createContext();

  await Promise.all(
    steps.map((step) => engine.evaluateStepCondition(step, context))
  );
});

/**
 * Benchmark: Cache hit rate test
 */
bench.add('Cache hit rate (target: >90%)', async () => {
  const engine = new ConditionalEvaluationEngine(
    createMockSandbox(),
    createMockVariableStore()
  );
  const steps = generateSteps(100);
  const context = createContext();

  for (let round = 0; round < 10; round++) {
    await Promise.all(
      steps.map((step) => engine.evaluateStepCondition(step, context))
    );
  }

  const stats = engine.getCacheStats();
  if (stats.hitRate < 0.9) {
    throw new Error(
      `Cache hit rate ${(stats.hitRate * 100).toFixed(2)}% is below 90% target`
    );
  }
});

/**
 * Benchmark: Sequential vs Parallel evaluation
 */
bench.add('Sequential evaluation (100 conditions)', async () => {
  const engine = new ConditionalEvaluationEngine(
    createMockSandbox(),
    createMockVariableStore()
  );
  const steps = generateSteps(100);
  const context = createContext();

  for (const step of steps) {
    await engine.evaluateStepCondition(step, context);
  }
});

/**
 * Run benchmarks
 */
async function runBenchmarks(): Promise<void> {
  console.log('🚀 Running Conditional Evaluation Performance Benchmarks\n');
  console.log('Target Performance:');
  console.log('  - 10 conditions: <10ms');
  console.log('  - 100 conditions: <100ms (CRITICAL)');
  console.log('  - 1000 conditions: <500ms');
  console.log('  - Cache hit rate: >90%');
  console.log('\n' + '='.repeat(60) + '\n');

  await bench.run();

  console.log('\n' + '='.repeat(60) + '\n');
  console.log('📊 Benchmark Results:\n');

  bench.tasks.forEach((task) => {
    const result = task.result;
    if (result === undefined) {
      console.log(`❓ ${task.name}: No result`);
      return;
    }

    const meanTime = result.mean * 1000; // Convert to ms
    const opsPerSec = result.hz;

    console.log(`\n${task.name}`);
    console.log(`  Mean time: ${meanTime.toFixed(2)}ms`);
    console.log(`  Ops/sec: ${opsPerSec.toFixed(0)}`);

    // Check if meets targets
    if (task.name.includes('10 conditions')) {
      const passed = meanTime < 10;
      console.log(`  Target: <10ms ${passed ? '✅ PASS' : '❌ FAIL'}`);
    } else if (task.name.includes('100 conditions') && task.name.includes('CRITICAL')) {
      const passed = meanTime < 100;
      console.log(`  Target: <100ms ${passed ? '✅ PASS' : '❌ FAIL'}`);
    } else if (task.name.includes('1000 conditions')) {
      const passed = meanTime < 500;
      console.log(`  Target: <500ms ${passed ? '✅ PASS' : '❌ FAIL'}`);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('\n✨ Benchmarks complete!\n');
}

// Run if executed directly
if (import.meta.main) {
  runBenchmarks().catch(console.error);
}

export { bench, runBenchmarks };
