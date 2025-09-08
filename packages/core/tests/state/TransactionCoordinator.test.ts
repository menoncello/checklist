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
    it('should validate transaction with custom validator', async () => {
      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'UPDATE', '/test', { valid: true });

      const validator = async (ops: Operation[]): Promise<boolean> => {
        return ops.every((op) => op.data && (op.data as Record<string, unknown>).valid === true);
      };

      const isValid = await coordinator.validateTransaction(txId, validator);
      expect(isValid).toBe(true);
    });

    it('should fail validation with invalid operations', async () => {
      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'UPDATE', '/test', { valid: false });

      const validator = async (ops: Operation[]): Promise<boolean> => {
        return ops.every((op) => op.data && (op.data as Record<string, unknown>).valid === true);
      };

      const isValid = await coordinator.validateTransaction(txId, validator);
      expect(isValid).toBe(false);
    });

    it('should handle validator errors', async () => {
      const txId = await coordinator.beginTransaction(testState);

      const validator = async (): Promise<boolean> => {
        throw new Error('Validation error');
      };

      const isValid = await coordinator.validateTransaction(txId, validator);
      expect(isValid).toBe(false);
    });
  });

  describe('Transaction Commit', () => {
    it('should commit transaction successfully', async () => {
      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'UPDATE', '/test', { value: 'updated' });

      const applyChanges = async (_ops: Operation[]): Promise<ChecklistState> => {
        return {
          ...testState,
          activeInstance: {
            id: 'test-id',
            templateId: 'template',
            templateVersion: '1.0.0',
            projectPath: '/test',
            status: 'active',
            startedAt: new Date().toISOString(),
            lastModifiedAt: new Date().toISOString(),
          },
        };
      };

      const newState = await coordinator.commitTransaction(txId, applyChanges);

      expect(newState.activeInstance).toBeDefined();
      expect(newState.activeInstance?.id).toBe('test-id');

      const transaction = await coordinator.getTransaction(txId);
      expect(transaction).toBeUndefined();
    });

    it('should rollback on commit failure', async () => {
      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'UPDATE', '/test', {});

      const applyChanges = async (): Promise<ChecklistState> => {
        throw new Error('Apply failed');
      };

      await expect(coordinator.commitTransaction(txId, applyChanges)).rejects.toThrow(
        TransactionError
      );

      const transaction = await coordinator.getTransaction(txId);
      expect(transaction).toBeUndefined();
    });

    it('should not commit non-existent transaction', async () => {
      const applyChanges = async (): Promise<ChecklistState> => testState;

      await expect(coordinator.commitTransaction('invalid-tx', applyChanges)).rejects.toThrow(
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
      expect(transaction).toBeUndefined();
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

      const applyChanges = async (): Promise<ChecklistState> => testState;
      await coordinator.commitTransaction(tx1, applyChanges);

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

      const applyChanges = async (): Promise<ChecklistState> => testState;
      await coordinator.commitTransaction(txId, applyChanges);

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

      const applyChanges = async (): Promise<ChecklistState> => testState;
      await coordinator.commitTransaction(txId, applyChanges);

      const hasIncompleteAfter = await coordinator.hasIncompleteTransactions();
      expect(hasIncompleteAfter).toBe(false);
    });

    it('should recover from WAL', async () => {
      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'write', '/recovery/test', { value: 'recovered' });

      // Simulate crash - create new coordinator instance
      const newCoordinator = new TransactionCoordinator(testLogDir);
      
      const appliedEntries: Array<{ op: string; key: string; value?: unknown }> = [];
      const recoveredCount = await newCoordinator.recoverFromWAL(async (entry) => {
        appliedEntries.push(entry);
      });

      expect(recoveredCount).toBe(1);
      expect(appliedEntries).toHaveLength(1);
      expect(appliedEntries[0]).toMatchObject({
        op: 'write',
        key: '/recovery/test',
        value: { value: 'recovered' }
      });

      await newCoordinator.cleanup();
    });

    it('should handle WAL recovery with no WAL file', async () => {
      const newCoordinator = new TransactionCoordinator(testLogDir);
      
      const recoveredCount = await newCoordinator.recoverFromWAL(async () => {
        // This should not be called
      });

      expect(recoveredCount).toBe(0);
      await newCoordinator.cleanup();
    });

    it('should create backup before recovery', async () => {
      const txId = await coordinator.beginTransaction(testState);
      await coordinator.addOperation(txId, 'write', '/backup/test', { value: 'backup' });

      const newCoordinator = new TransactionCoordinator(testLogDir);
      
      await newCoordinator.recoverFromWAL(async () => {});

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
      
      let errorCount = 0;
      const recoveredCount = await newCoordinator.recoverFromWAL(async (entry) => {
        errorCount++;
        throw new Error('Apply failed');
      });

      expect(recoveredCount).toBe(0);
      expect(errorCount).toBe(1);
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

      const sizeAfter = await coordinator.getWALSize();
      
      if (sizeBefore > 100) {
        expect(sizeAfter).toBe(0);
      } else {
        expect(sizeAfter).toBe(sizeBefore);
      }
    });
  });
});
