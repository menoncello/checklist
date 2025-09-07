import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Bench } from 'tinybench';
import { TransactionCoordinator } from '../../src/state/TransactionCoordinator';
import { WriteAheadLog } from '../../src/state/WriteAheadLog';
import type { ChecklistState } from '../../src/state/types';

const createTestState = (): ChecklistState => ({
  schemaVersion: '1.0.0',
  checksum: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
  completedSteps: [],
  recovery: { dataLoss: false },
  conflicts: {},
});

async function runWALBenchmarks() {
  console.log('🚀 WAL Performance Benchmarks\n');
  console.log('================================\n');

  // Setup
  const testDir = await mkdtemp(join(tmpdir(), 'wal-bench-'));

  // Benchmark WAL operations
  const walBench = new Bench({ time: 1000 });

  walBench
    .add('WAL append single entry', async () => {
      const wal = new WriteAheadLog(testDir);
      await wal.append({
        op: 'write',
        key: '/test/key',
        value: { data: 'test' },
      });
      await wal.clear();
    })
    .add('WAL append 10 entries', async () => {
      const wal = new WriteAheadLog(testDir);
      for (let i = 0; i < 10; i++) {
        await wal.append({
          op: 'write',
          key: `/test/key${i}`,
          value: { data: `test${i}` },
        });
      }
      await wal.clear();
    })
    .add('WAL replay 10 entries', async () => {
      const wal = new WriteAheadLog(testDir);
      for (let i = 0; i < 10; i++) {
        await wal.append({
          op: 'write',
          key: `/test/key${i}`,
          value: { data: `test${i}` },
        });
      }
      const wal2 = new WriteAheadLog(testDir);
      await wal2.replay();
      await wal2.clear();
    })
    .add('WAL clear', async () => {
      const wal = new WriteAheadLog(testDir);
      await wal.append({
        op: 'write',
        key: '/test/key',
        value: { data: 'test' },
      });
      await wal.clear();
    });

  await walBench.run();

  console.log('WAL Operation Benchmarks:');
  console.log('-------------------------');
  walBench.tasks.forEach((task) => {
    const avgTime = task.result?.mean ?? 0;
    const ops = task.result?.hz ?? 0;
    const target = getTargetForOperation(task.name);
    const status = avgTime < target ? '✅' : '❌';
    
    console.log(`${task.name}:`);
    console.log(`  Average: ${avgTime.toFixed(2)}ms (Target: <${target}ms) ${status}`);
    console.log(`  Ops/sec: ${ops.toFixed(0)}`);
    console.log('');
  });

  // Benchmark Transaction operations with WAL
  const txBench = new Bench({ time: 1000 });

  txBench
    .add('Transaction with WAL write', async () => {
      const coordinator = new TransactionCoordinator(testDir);
      const state = createTestState();
      const txId = await coordinator.beginTransaction(state);
      await coordinator.addOperation(txId, 'write', '/test', { value: 'data' });
      await coordinator.commitTransaction(txId, async () => state);
    })
    .add('Transaction with 5 WAL writes', async () => {
      const coordinator = new TransactionCoordinator(testDir);
      const state = createTestState();
      const txId = await coordinator.beginTransaction(state);
      for (let i = 0; i < 5; i++) {
        await coordinator.addOperation(txId, 'write', `/test${i}`, { value: `data${i}` });
      }
      await coordinator.commitTransaction(txId, async () => state);
    })
    .add('Transaction rollback with WAL', async () => {
      const coordinator = new TransactionCoordinator(testDir);
      const state = createTestState();
      const txId = await coordinator.beginTransaction(state);
      await coordinator.addOperation(txId, 'write', '/test', { value: 'data' });
      await coordinator.rollbackTransaction(txId);
    });

  await txBench.run();

  console.log('\nTransaction with WAL Benchmarks:');
  console.log('--------------------------------');
  txBench.tasks.forEach((task) => {
    const avgTime = task.result?.mean ?? 0;
    const ops = task.result?.hz ?? 0;
    const target = 100; // 100ms target for transactions
    const status = avgTime < target ? '✅' : '❌';
    
    console.log(`${task.name}:`);
    console.log(`  Average: ${avgTime.toFixed(2)}ms (Target: <${target}ms) ${status}`);
    console.log(`  Ops/sec: ${ops.toFixed(0)}`);
    console.log('');
  });

  // Benchmark Recovery operations
  const recoveryBench = new Bench({ time: 1000 });

  recoveryBench
    .add('WAL recovery with 10 entries', async () => {
      const coordinator = new TransactionCoordinator(testDir);
      const state = createTestState();
      const txId = await coordinator.beginTransaction(state);
      for (let i = 0; i < 10; i++) {
        await coordinator.addOperation(txId, 'write', `/recovery${i}`, { value: `data${i}` });
      }
      
      const coordinator2 = new TransactionCoordinator(testDir);
      await coordinator2.recoverFromWAL(async () => {});
    })
    .add('WAL recovery with 50 entries', async () => {
      const coordinator = new TransactionCoordinator(testDir);
      const state = createTestState();
      const txId = await coordinator.beginTransaction(state);
      for (let i = 0; i < 50; i++) {
        await coordinator.addOperation(txId, 'write', `/recovery${i}`, { value: `data${i}` });
      }
      
      const coordinator2 = new TransactionCoordinator(testDir);
      await coordinator2.recoverFromWAL(async () => {});
    });

  await recoveryBench.run();

  console.log('\nRecovery Performance Benchmarks:');
  console.log('--------------------------------');
  recoveryBench.tasks.forEach((task) => {
    const avgTime = task.result?.mean ?? 0;
    const ops = task.result?.hz ?? 0;
    const target = task.name.includes('50') ? 200 : 100; // Different targets based on entry count
    const status = avgTime < target ? '✅' : '❌';
    
    console.log(`${task.name}:`);
    console.log(`  Average: ${avgTime.toFixed(2)}ms (Target: <${target}ms) ${status}`);
    console.log(`  Ops/sec: ${ops.toFixed(0)}`);
    console.log('');
  });

  // Large payload benchmark
  const largeBench = new Bench({ time: 1000 });
  const largePayload = { data: 'x'.repeat(10000) }; // 10KB payload

  largeBench
    .add('WAL append with large payload', async () => {
      const wal = new WriteAheadLog(testDir);
      await wal.append({
        op: 'write',
        key: '/large/test',
        value: largePayload,
      });
      await wal.clear();
    })
    .add('WAL replay with large payload', async () => {
      const wal = new WriteAheadLog(testDir);
      await wal.append({
        op: 'write',
        key: '/large/test',
        value: largePayload,
      });
      const wal2 = new WriteAheadLog(testDir);
      await wal2.replay();
      await wal2.clear();
    });

  await largeBench.run();

  console.log('\nLarge Payload Benchmarks:');
  console.log('-------------------------');
  largeBench.tasks.forEach((task) => {
    const avgTime = task.result?.mean ?? 0;
    const ops = task.result?.hz ?? 0;
    const target = 20; // 20ms target for large payloads
    const status = avgTime < target ? '✅' : '❌';
    
    console.log(`${task.name}:`);
    console.log(`  Average: ${avgTime.toFixed(2)}ms (Target: <${target}ms) ${status}`);
    console.log(`  Ops/sec: ${ops.toFixed(0)}`);
    console.log('');
  });

  // Summary
  console.log('\n================================');
  console.log('Performance Summary');
  console.log('================================\n');

  const allBenches = [walBench, txBench, recoveryBench, largeBench];
  let passedCount = 0;
  let totalCount = 0;

  allBenches.forEach((bench) => {
    bench.tasks.forEach((task) => {
      const avgTime = task.result?.mean ?? 0;
      const target = getTargetForOperation(task.name);
      if (avgTime < target) passedCount++;
      totalCount++;
    });
  });

  console.log(`✅ Passed: ${passedCount}/${totalCount} benchmarks`);
  
  if (passedCount === totalCount) {
    console.log('\n🎉 All performance targets met!');
  } else {
    console.log(`\n⚠️  ${totalCount - passedCount} benchmarks exceeded target times`);
  }

  // Cleanup
  if (existsSync(testDir)) {
    await rm(testDir, { recursive: true, force: true });
  }
}

function getTargetForOperation(operation: string): number {
  if (operation.includes('append single')) return 10;
  if (operation.includes('append 10')) return 20;
  if (operation.includes('replay')) return 100;
  if (operation.includes('clear')) return 5;
  if (operation.includes('Transaction')) return 100;
  if (operation.includes('recovery with 50')) return 200;
  if (operation.includes('recovery')) return 100;
  if (operation.includes('large')) return 20;
  return 50; // Default target
}

// Run benchmarks
runWALBenchmarks().catch(console.error);