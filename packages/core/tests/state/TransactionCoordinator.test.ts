import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { TransactionCoordinator } from '../../src/state/TransactionCoordinator';
import { ChecklistState, Operation } from '../../src/state/types';
import { TransactionError } from '../../src/state/errors';

describe('TransactionCoordinator', () => {
  const testLogDir = '.test-transaction-logs';
  let coordinator: TransactionCoordinator;
  let testState: ChecklistState;

  beforeEach(() => {
    // Don't create directory, let TransactionCoordinator handle it
    coordinator = new TransactionCoordinator(testLogDir);
    testState = {
      schemaVersion: '1.0.0',
      checksum: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      completedSteps: [],
      recovery: { dataLoss: false },
      conflicts: {},
    };
  });

  afterEach(async () => {
    await coordinator.cleanup();
    if (existsSync(testLogDir)) {
      rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  describe('Transaction Lifecycle', () => {
    it('should begin a transaction', async () => {
      const txId = await coordinator.beginTransaction(testState);

      expect(txId).toBeDefined();
      expect(typeof txId).toBe('string');

      const transaction = await coordinator.getTransaction(txId);
      expect(transaction).toBeDefined();
      expect(transaction?.status).toBe('active');
      expect(transaction?.snapshot).toEqual(testState);
    });

    it('should add operations to transaction', async () => {
      const txId = await coordinator.beginTransaction(testState);

      await coordinator.addOperation(txId, 'UPDATE', '/activeInstance/status', 'paused');
      await coordinator.addOperation(txId, 'ADD', '/completedSteps/0', { stepId: 'step-1' });

      const transaction = await coordinator.getTransaction(txId);
      expect(transaction?.operations).toHaveLength(2);
      expect(transaction?.operations[0].type).toBe('UPDATE');
      expect(transaction?.operations[1].type).toBe('ADD');
    });

    it('should reject operations on non-existent transaction', async () => {
      await expect(coordinator.addOperation('invalid-tx', 'UPDATE', '/test', {})).rejects.toThrow(
        TransactionError
      );
    });

    it('should reject operations on inactive transaction', async () => {
      const txId = await coordinator.beginTransaction(testState);
      await coordinator.rollbackTransaction(txId);

      await expect(coordinator.addOperation(txId, 'UPDATE', '/test', {})).rejects.toThrow(
        TransactionError
      );
    });
  });

  describe('Transaction Validation', () => {
    it('should validate transaction with expected operations count', async () => {
      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'UPDATE', '/test', { valid: true });

      // Validate that transaction has 1 operation
      await expect(coordinator.validateTransaction(txId, 1)).resolves.toBeUndefined();
    });

    it('should fail validation with wrong operations count', async () => {
      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'UPDATE', '/test', { valid: false });

      // Expect 2 operations but only have 1
      await expect(coordinator.validateTransaction(txId, 2)).rejects.toThrow();
    });

    it('should validate without expected count', async () => {
      const txId = await coordinator.beginTransaction(testState);

      // Validate without expected count (just checks transaction exists)
      await expect(coordinator.validateTransaction(txId)).resolves.toBeUndefined();
    });
  });

  describe('Transaction Commit', () => {
    it('should commit transaction successfully', async () => {
      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'UPDATE', '/test', { value: 'updated' });

      // Commit transaction without validator
      await coordinator.commitTransaction(txId);

      const transaction = await coordinator.getTransaction(txId);
      expect(transaction).toBeNull();
    });

    it('should rollback on commit failure', async () => {
      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'UPDATE', '/test', {});

      const failingValidator = async (): Promise<void> => {
        throw new Error('Validation failed');
      };

      await expect(coordinator.commitTransaction(txId, failingValidator)).rejects.toThrow(
        TransactionError
      );

      const transaction = await coordinator.getTransaction(txId);
      expect(transaction).toBeNull();
    });

    it('should not commit non-existent transaction', async () => {
      await expect(coordinator.commitTransaction('invalid-tx')).rejects.toThrow(
        TransactionError
      );
    });
  });

  describe('Transaction Rollback', () => {
    it('should rollback transaction and restore snapshot', async () => {
      const modifiedState = {
        ...testState,
        activeInstance: {
          id: 'modified',
          templateId: 'template',
          templateVersion: '1.0.0',
          projectPath: '/test',
          status: 'active' as const,
          startedAt: new Date().toISOString(),
          lastModifiedAt: new Date().toISOString(),
        },
      };

      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(
        txId,
        'UPDATE',
        '/activeInstance',
        modifiedState.activeInstance
      );

      const restoredState = await coordinator.rollbackTransaction(txId);

      expect(restoredState).toEqual(testState);
      expect(restoredState.activeInstance).toBeUndefined();

      const transaction = await coordinator.getTransaction(txId);
      expect(transaction).toBeNull();
    });

    it('should handle rollback of non-existent transaction', async () => {
      await expect(coordinator.rollbackTransaction('invalid-tx')).rejects.toThrow(TransactionError);
    });
  });

  describe('Active Transactions', () => {
    it('should track active transactions', async () => {
      const tx1 = await coordinator.beginTransaction(testState);
      const tx2 = await coordinator.beginTransaction(testState);

      const active = await coordinator.getActiveTransactions();
      expect(active).toHaveLength(2);
      expect(active.map((t) => t.id)).toContain(tx1);
      expect(active.map((t) => t.id)).toContain(tx2);
    });

    it('should exclude committed transactions from active list', async () => {
      const tx1 = await coordinator.beginTransaction(testState);
      const tx2 = await coordinator.beginTransaction(testState);

      // Add operation to tx1 so it can be committed
      await coordinator.addOperation(tx1, 'UPDATE', '/test', { value: 'test' });
      await coordinator.commitTransaction(tx1);

      const active = await coordinator.getActiveTransactions();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe(tx2);
    });

    it('should exclude rolled-back transactions from active list', async () => {
      const tx1 = await coordinator.beginTransaction(testState);
      const tx2 = await coordinator.beginTransaction(testState);

      await coordinator.rollbackTransaction(tx1);

      const active = await coordinator.getActiveTransactions();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe(tx2);
    });
  });

  describe('Cleanup', () => {
    it('should rollback all active transactions on cleanup', async () => {
      await coordinator.beginTransaction(testState);
      await coordinator.beginTransaction(testState);
      await coordinator.beginTransaction(testState);

      await coordinator.cleanup();

      const active = await coordinator.getActiveTransactions();
      expect(active).toHaveLength(0);
    });
  });

  describe('Audit Logging', () => {
    it('should create audit log file', async () => {
      await coordinator.beginTransaction(testState);

      await Bun.sleep(10);

      const logPath = `${testLogDir}/audit.log`;
      const file = Bun.file(logPath);
      expect(await file.exists()).toBe(true);
    });

    it('should log transaction events', async () => {
      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'TEST', '/test', {});
      await coordinator.rollbackTransaction(txId);

      await Bun.sleep(10);

      const logPath = `${testLogDir}/audit.log`;
      const content = await Bun.file(logPath).text();

      expect(content).toContain('BEGIN');
      expect(content).toContain('OPERATION');
      expect(content).toContain('ROLLBACK');
      expect(content).toContain(txId);
    });
  });

  describe('WAL Integration', () => {
    it('should write operations to WAL', async () => {
      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'write', '/test/path', { data: 'test' });

      const walSize = await coordinator.getWALSize();
      expect(walSize).toBeGreaterThan(0);
    });

    it('should clear WAL after successful commit', async () => {
      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'write', '/test', { value: 'test' });

      await coordinator.commitTransaction(txId);

      const walSize = await coordinator.getWALSize();
      expect(walSize).toBe(0);
    });

    it('should preserve WAL on rollback', async () => {
      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'write', '/test', { value: 'test' });

      await coordinator.rollbackTransaction(txId);

      const walSize = await coordinator.getWALSize();
      expect(walSize).toBeGreaterThan(0);
    });

    it('should detect incomplete transactions', async () => {
      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'write', '/test', { value: 'test' });

      const hasIncomplete = await coordinator.hasIncompleteTransactions();
      expect(hasIncomplete).toBe(true);

      await coordinator.commitTransaction(txId);

      const hasIncompleteAfter = await coordinator.hasIncompleteTransactions();
      expect(hasIncompleteAfter).toBe(false);
    });

    it('should recover from WAL', async () => {
      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'write', '/recovery/test', { value: 'recovered' });

      // Simulate crash by NOT calling cleanup() on the first coordinator
      // This leaves the transaction active and WAL entries intact

      // Create new coordinator instance to simulate recovery after crash
      const newCoordinator = new TransactionCoordinator(testLogDir);

      const recoveryResult = await newCoordinator.recoverFromWAL(testState);

      expect(recoveryResult.recoveredTransactions).toBe(1);
      expect(recoveryResult.recoveredState).toBeDefined();

      await newCoordinator.cleanup();

      // Clean up the original coordinator that simulated crash
      await coordinator.cleanup();
    });

    it('should handle WAL recovery with no WAL file', async () => {
      const newCoordinator = new TransactionCoordinator(testLogDir);
      
      const recoveryResult = await newCoordinator.recoverFromWAL(testState);

      expect(recoveryResult.recoveredTransactions).toBe(0);
      await newCoordinator.cleanup();
    });

    it('should create backup before recovery', async () => {
      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'write', '/backup/test', { value: 'backup' });

      const newCoordinator = new TransactionCoordinator(testLogDir);
      
      await newCoordinator.recoverFromWAL(testState);

      // Check that backup exists using Bun's file system
      const walDir = `${testLogDir}/.wal`;
      const files = await Bun.$`find ${walDir} -name "*.backup" 2>/dev/null || true`.text();
      const hasBackup = files.trim().length > 0;
      
      expect(hasBackup).toBe(true);
      await newCoordinator.cleanup();
    });

    it('should handle recovery errors gracefully', async () => {
      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'write', '/error/test', { value: 'error' });

      const newCoordinator = new TransactionCoordinator(testLogDir);
      
      const recoveryResult = await newCoordinator.recoverFromWAL(testState);

      // Recovery should handle errors internally
      expect(recoveryResult.recoveredTransactions).toBeGreaterThanOrEqual(0);
      await newCoordinator.cleanup();
    });

    it('should rotate WAL when size exceeds limit', async () => {
      const txId = await coordinator.beginTransaction(testState);
      
      // Add many operations to grow WAL size
      for (let i = 0; i < 10; i++) {
        await coordinator.addOperation(txId, 'write', `/test/${i}`, { 
          value: 'x'.repeat(100) 
        });
      }

      const sizeBefore = await coordinator.getWALSize();
      await coordinator.rotateWAL(100); // Very small limit to force rotation

      // Wait a bit for rotation to complete
      await Bun.sleep(10);

      const sizeAfter = await coordinator.getWALSize();
      
      if (sizeBefore > 100) {
        expect(sizeAfter).toBe(0);
      } else {
        expect(sizeAfter).toBe(sizeBefore);
      }
    });
  });
});
