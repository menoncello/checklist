import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { TransactionCoordinator } from '../../src/state/TransactionCoordinator';
import { StateManager } from '../../src/state/StateManager';
import { WorkflowEngine } from '../../src/workflow/WorkflowEngine';
import type { ChecklistState } from '../../src/state/types';

describe('WAL Crash Recovery', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'wal-crash-test-'));
  });

  afterEach(async () => {
    if (testDir && existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('Transaction Crash Recovery', () => {
    it('should recover from crash during transaction', async () => {
      // Setup initial transaction coordinator
      const coordinator1 = new TransactionCoordinator(testDir);
      const testState: ChecklistState = {
        schemaVersion: '1.0.0',
        checksum: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        completedSteps: [],
        recovery: { dataLoss: false },
        conflicts: {},
      };

      // Start transaction and add operations
      const txId = await coordinator1.beginTransaction(testState);
      await coordinator1.addOperation(txId, 'write', '/crash/test1', { value: 'data1' });
      await coordinator1.addOperation(txId, 'write', '/crash/test2', { value: 'data2' });
      await coordinator1.addOperation(txId, 'delete', '/crash/test3');

      // Verify WAL exists
      expect(await coordinator1.hasIncompleteTransactions()).toBe(true);

      // Simulate crash - don't commit or rollback
      // Create new coordinator instance (simulating restart after crash)
      const coordinator2 = new TransactionCoordinator(testDir);

      // Should detect incomplete transactions
      expect(await coordinator2.hasIncompleteTransactions()).toBe(true);

      // Recover from WAL
      const recoveredOps: Array<{ op: string; key: string; value?: unknown }> = [];
      const recoveredCount = await coordinator2.recoverFromWAL(async (entry) => {
        recoveredOps.push(entry);
      });

      // Verify recovery
      expect(recoveredCount).toBe(3);
      expect(recoveredOps).toHaveLength(3);
      expect(recoveredOps[0]).toMatchObject({
        op: 'write',
        key: '/crash/test1',
        value: { value: 'data1' }
      });
      expect(recoveredOps[1]).toMatchObject({
        op: 'write',
        key: '/crash/test2',
        value: { value: 'data2' }
      });
      expect(recoveredOps[2]).toMatchObject({
        op: 'delete',
        key: '/crash/test3'
      });

      // WAL should be cleared after successful recovery
      expect(await coordinator2.hasIncompleteTransactions()).toBe(false);

      await coordinator2.cleanup();
    });

    it('should handle partial WAL writes during crash', async () => {
      const coordinator = new TransactionCoordinator(testDir);
      const testState: ChecklistState = {
        schemaVersion: '1.0.0',
        checksum: 'sha256:0000',
        completedSteps: [],
        recovery: { dataLoss: false },
        conflicts: {},
      };

      // Create a valid transaction
      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'write', '/partial/test', { value: 'complete' });

      // Manually corrupt WAL to simulate partial write
      const walPath = join(testDir, '.wal', 'wal.log');
      const walContent = await readFile(walPath, 'utf-8');
      const corruptedContent = walContent + '{"op":"write","key":"partial","val';
      await writeFile(walPath, corruptedContent);

      // Create new coordinator and attempt recovery
      const coordinator2 = new TransactionCoordinator(testDir);
      const recoveredOps: Array<{ op: string; key: string; value?: unknown }> = [];
      const recoveredCount = await coordinator2.recoverFromWAL(async (entry) => {
        recoveredOps.push(entry);
      });

      // Should recover only the complete entry
      expect(recoveredCount).toBe(1);
      expect(recoveredOps[0].key).toBe('/partial/test');

      await coordinator2.cleanup();
    });
  });

  describe('StateManager Recovery', () => {
    it.skip('should recover state on initialization after crash', async () => {
      // Setup state manager with incomplete transaction
      const stateManager1 = new StateManager(testDir);
      await stateManager1.initializeState();

      // Create transaction coordinator to simulate incomplete transaction
      const coordinator = new TransactionCoordinator(join(testDir, 'logs'));
      const state = stateManager1.getCurrentState();
      const txId = await coordinator.beginTransaction(state!);
      await coordinator.addOperation(txId, 'write', '/state/recovery', { test: 'value' });

      // Cleanup state manager but not coordinator to simulate crash
      await stateManager1.cleanup();

      // Create new state manager instance
      const stateManager2 = new StateManager(testDir);
      
      // Should trigger recovery on initialization
      const recoveredState = await stateManager2.initializeState();
      
      // Recovery metadata should be set
      expect(recoveredState.recovery).toBeDefined();
      
      await stateManager2.cleanup();
    });

    it('should handle concurrent recovery attempts', async () => {
      // Setup state with incomplete transaction
      const coordinator = new TransactionCoordinator(testDir);
      const testState: ChecklistState = {
        schemaVersion: '1.0.0',
        checksum: 'sha256:0000',
        completedSteps: [],
        recovery: { dataLoss: false },
        conflicts: {},
      };

      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'write', '/concurrent/test', { value: 'data' });

      // Simulate multiple recovery attempts
      const coordinator2 = new TransactionCoordinator(testDir);
      
      const recovery1 = coordinator2.recoverFromWAL(async () => {
        await Bun.sleep(10); // Simulate slow recovery
      });
      
      const recovery2 = coordinator2.recoverFromWAL(async () => {
        // This should be skipped due to concurrent recovery
      });

      const [result1, result2] = await Promise.all([recovery1, recovery2]);
      
      // Only one recovery should succeed
      const totalRecovered = result1 + result2;
      expect(totalRecovered).toBe(1);

      await coordinator2.cleanup();
    });
  });

  describe('WorkflowEngine Recovery', () => {
    it.skip('should recover workflow state after crash', async () => {
      // Create a test template file first
      const templatePath = join(testDir, 'templates');
      await Bun.write(
        join(templatePath, 'test-template.yaml'),
        `id: test-template
name: Test Template
steps:
  - id: step1
    name: First Step
    description: Test step`
      );

      // Simulate incomplete transaction without initializing engine
      const coordinator = new TransactionCoordinator(join(testDir, 'logs'));
      const testState: ChecklistState = {
        schemaVersion: '1.0.0',
        checksum: 'sha256:0000',
        completedSteps: [],
        recovery: { dataLoss: false },
        conflicts: {},
      };
      
      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'write', '/workflow/state', { 
        currentStep: 'step1',
        status: 'active' 
      });

      // Don't cleanup coordinator - simulate crash

      // Create new engine instance
      const engine = new WorkflowEngine(testDir);
      
      let recoveryStarted = false;
      let recoveryCompleted = false;
      let recoveredOps = 0;

      engine.on('recovery:started', (data) => {
        recoveryStarted = true;
        expect(data.type).toBe('wal');
      });

      engine.on('recovery:completed', (data) => {
        recoveryCompleted = true;
        recoveredOps = data.recoveredOperations;
      });

      // Initialize should trigger recovery
      await engine.init('test-template');

      // Verify recovery events were emitted
      expect(recoveryStarted).toBe(true);
      expect(recoveryCompleted).toBe(true);
      expect(recoveredOps).toBe(1);

      await engine.cleanup();
    });
  });

  describe('Performance During Recovery', () => {
    it('should recover quickly from large WAL', async () => {
      const coordinator = new TransactionCoordinator(testDir);
      const testState: ChecklistState = {
        schemaVersion: '1.0.0',
        checksum: 'sha256:0000',
        completedSteps: [],
        recovery: { dataLoss: false },
        conflicts: {},
      };

      // Create many operations
      const txId = await coordinator.beginTransaction(testState);
      const operationCount = 100;
      
      for (let i = 0; i < operationCount; i++) {
        await coordinator.addOperation(txId, 'write', `/perf/test${i}`, { 
          value: `data${i}`,
          payload: 'x'.repeat(100)
        });
      }

      // Measure recovery time
      const coordinator2 = new TransactionCoordinator(testDir);
      
      const startTime = performance.now();
      const recoveredCount = await coordinator2.recoverFromWAL(async () => {
        // Minimal processing
      });
      const duration = performance.now() - startTime;

      expect(recoveredCount).toBe(operationCount);
      expect(duration).toBeLessThan(200); // Should be under 200ms for 100 operations
      
      console.log(`Recovered ${operationCount} operations in ${duration.toFixed(2)}ms`);

      await coordinator2.cleanup();
    });

    it('should handle WAL rotation during recovery', async () => {
      const coordinator = new TransactionCoordinator(testDir);
      const testState: ChecklistState = {
        schemaVersion: '1.0.0',
        checksum: 'sha256:0000',
        completedSteps: [],
        recovery: { dataLoss: false },
        conflicts: {},
      };

      // Create large WAL
      const txId = await coordinator.beginTransaction(testState);
      for (let i = 0; i < 10; i++) {
        await coordinator.addOperation(txId, 'write', `/rotate/test${i}`, {
          largeValue: 'x'.repeat(1000)
        });
      }

      const sizeBefore = await coordinator.getWALSize();
      expect(sizeBefore).toBeGreaterThan(0);

      // Rotate WAL with small limit
      await coordinator.rotateWAL(100);

      // After rotation, if size was > 100, it should be 0
      const sizeAfter = await coordinator.getWALSize();
      if (sizeBefore > 100) {
        expect(sizeAfter).toBe(0);
      }

      await coordinator.cleanup();
    });
  });

  describe('Edge Cases', () => {
    it('should handle recovery with empty WAL', async () => {
      const coordinator = new TransactionCoordinator(testDir);
      
      const recoveredCount = await coordinator.recoverFromWAL(async () => {
        throw new Error('Should not be called');
      });

      expect(recoveredCount).toBe(0);
      await coordinator.cleanup();
    });

    it('should handle recovery errors gracefully', async () => {
      const coordinator = new TransactionCoordinator(testDir);
      const testState: ChecklistState = {
        schemaVersion: '1.0.0',
        checksum: 'sha256:0000',
        completedSteps: [],
        recovery: { dataLoss: false },
        conflicts: {},
      };

      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'write', '/error/test', { value: 'data' });

      const coordinator2 = new TransactionCoordinator(testDir);
      
      let errorCount = 0;
      const recoveredCount = await coordinator2.recoverFromWAL(async () => {
        errorCount++;
        throw new Error('Recovery failed');
      });

      expect(recoveredCount).toBe(0);
      expect(errorCount).toBe(1);
      
      // WAL should still exist after failed recovery
      expect(await coordinator2.hasIncompleteTransactions()).toBe(true);

      await coordinator2.cleanup();
    });

    it('should create backup before recovery', async () => {
      const coordinator = new TransactionCoordinator(testDir);
      const testState: ChecklistState = {
        schemaVersion: '1.0.0',
        checksum: 'sha256:0000',
        completedSteps: [],
        recovery: { dataLoss: false },
        conflicts: {},
      };

      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'write', '/backup/test', { value: 'backup' });

      const coordinator2 = new TransactionCoordinator(testDir);
      await coordinator2.recoverFromWAL(async () => {});

      // Check for backup files
      const walDir = join(testDir, '.wal');
      const { stdout } = await Bun.$`ls ${walDir}/*.backup 2>/dev/null || true`.quiet();
      const hasBackup = stdout.toString().trim().length > 0;
      
      expect(hasBackup).toBe(true);

      await coordinator2.cleanup();
    });
  });
});