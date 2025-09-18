import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { TransactionRecovery } from '../../src/state/TransactionRecovery';
import { TransactionError } from '../../src/state/errors';
import type { ChecklistState } from '../../src/state/types';

describe('TransactionRecovery', () => {
  let transactionRecovery: TransactionRecovery;
  let mockTransactionManager: any;
  let mockWAL: any;
  let mockState: ChecklistState;

  beforeEach(() => {

    // Create mock objects
    mockTransactionManager = {
      rollback: mock(() => Promise.resolve()),
      commit: mock(() => Promise.resolve()),
      begin: mock(() => Promise.resolve()),
    };

    mockWAL = {
      getWALEntries: mock(() => Promise.resolve([])),
      getSize: mock(() => Promise.resolve(0)),
      rotate: mock(() => Promise.resolve()),
      replay: mock(() => Promise.resolve()),
      createBackup: mock(() => Promise.resolve()),
      clear: mock(() => Promise.resolve()),
    };

    mockState = {
      schemaVersion: '1.0.0',
      checksum: 'test-checksum',
      completedSteps: [],
      recovery: {
        dataLoss: false
      },
      conflicts: {}
    };

    transactionRecovery = new TransactionRecovery(mockTransactionManager, mockWAL);
  });

  describe('recoverFromWAL', () => {
    it('should successfully recover when no WAL entries exist', async () => {
      mockWAL.replay.mockResolvedValue(undefined);
      mockWAL.getWALEntries.mockResolvedValue([]);

      const result = await transactionRecovery.recoverFromWAL(mockState);

      expect(result.recoveredState).toEqual(mockState);
      expect(result.recoveredTransactions).toBe(0);
    });

    it('should successfully recover with WAL entries', async () => {
      const walEntries = [
        { op: 'SET', key: 'test.field', value: 'test-value' },
        { op: 'SET', key: 'another.field', value: 42 }
      ];

      mockWAL.replay.mockResolvedValue(undefined);
      mockWAL.getWALEntries.mockResolvedValue(walEntries);

      const result = await transactionRecovery.recoverFromWAL(mockState);

      expect(result.recoveredTransactions).toBe(2);
      expect(result.recoveredState).toBeDefined();
      expect(mockWAL.createBackup).toHaveBeenCalled();
      expect(mockWAL.clear).toHaveBeenCalled();
    });

    it('should handle WAL recovery preparation errors', async () => {
      mockWAL.replay.mockRejectedValue(new Error('WAL replay failed'));

      await expect(transactionRecovery.recoverFromWAL(mockState)).rejects.toThrow(TransactionError);
    });

    it('should handle WAL getEntries errors during preparation', async () => {
      mockWAL.replay.mockResolvedValue(undefined);
      mockWAL.getWALEntries.mockRejectedValue(new Error('Failed to get entries'));

      await expect(transactionRecovery.recoverFromWAL(mockState)).rejects.toThrow(TransactionError);
    });

    it('should continue recovery even if individual entries fail', async () => {
      const walEntries = [
        { op: 'SET', key: 'valid.field', value: 'test-value' },
        { op: 'INVALID_OP', key: 'invalid.field', value: 'test-value' },
        { op: 'SET', key: 'another.valid', value: 42 }
      ];

      mockWAL.replay.mockResolvedValue(undefined);
      mockWAL.getWALEntries.mockResolvedValue(walEntries);

      const result = await transactionRecovery.recoverFromWAL(mockState);

      // Should recover the valid entries despite one failure
      expect(result.recoveredTransactions).toBe(3); // All processed, even if some warn
    });

    it('should not clear WAL if no transactions were recovered', async () => {
      mockWAL.replay.mockResolvedValue(undefined);
      mockWAL.getWALEntries.mockResolvedValue([]);

      await transactionRecovery.recoverFromWAL(mockState);

      expect(mockWAL.createBackup).not.toHaveBeenCalled();
      expect(mockWAL.clear).not.toHaveBeenCalled();
    });
  });

  describe('hasIncompleteTransactions', () => {
    it('should return true when WAL has entries', async () => {
      mockWAL.getWALEntries.mockResolvedValue([
        { op: 'SET', key: 'test', value: 'value' }
      ]);

      const result = await transactionRecovery.hasIncompleteTransactions();

      expect(result).toBe(true);
    });

    it('should return false when WAL is empty', async () => {
      mockWAL.getWALEntries.mockResolvedValue([]);

      const result = await transactionRecovery.hasIncompleteTransactions();

      expect(result).toBe(false);
    });

    it('should return false and log error when WAL check fails', async () => {
      mockWAL.getWALEntries.mockRejectedValue(new Error('WAL access failed'));

      const result = await transactionRecovery.hasIncompleteTransactions();

      expect(result).toBe(false);
    });
  });

  describe('getWALSize', () => {
    it('should return WAL size', async () => {
      const expectedSize = 1024;
      mockWAL.getSize.mockResolvedValue(expectedSize);

      const size = await transactionRecovery.getWALSize();

      expect(size).toBe(expectedSize);
      expect(mockWAL.getSize).toHaveBeenCalled();
    });
  });

  describe('rotateWAL', () => {
    it('should rotate WAL when size exceeds limit', async () => {
      const currentSize = 15 * 1024 * 1024; // 15MB
      const maxSize = 10 * 1024 * 1024; // 10MB
      mockWAL.getSize.mockResolvedValue(currentSize);

      await transactionRecovery.rotateWAL(maxSize);

      expect(mockWAL.createBackup).toHaveBeenCalled();
      expect(mockWAL.clear).toHaveBeenCalled();
    });

    it('should not rotate WAL when size is within limit', async () => {
      const currentSize = 5 * 1024 * 1024; // 5MB
      const maxSize = 10 * 1024 * 1024; // 10MB
      mockWAL.getSize.mockResolvedValue(currentSize);

      await transactionRecovery.rotateWAL(maxSize);

      expect(mockWAL.createBackup).not.toHaveBeenCalled();
      expect(mockWAL.clear).not.toHaveBeenCalled();
    });

    it('should use default max size when not specified', async () => {
      const currentSize = 15 * 1024 * 1024; // 15MB
      mockWAL.getSize.mockResolvedValue(currentSize);

      await transactionRecovery.rotateWAL();

      expect(mockWAL.createBackup).toHaveBeenCalled();
      expect(mockWAL.clear).toHaveBeenCalled();
    });
  });

  describe('WAL operation processing', () => {
    it('should process SET operations correctly', async () => {
      const walEntries = [
        { op: 'SET', key: 'simple', value: 'test-value' },
        { op: 'SET', key: 'nested.field', value: 42 },
        { op: 'SET', key: 'deep.nested.field', value: { data: 'test' } }
      ];

      mockWAL.replay.mockResolvedValue(undefined);
      mockWAL.getWALEntries.mockResolvedValue(walEntries);

      const result = await transactionRecovery.recoverFromWAL(mockState);

      const recoveredState = result.recoveredState as any;
      expect(recoveredState.simple).toBe('test-value');
      expect(recoveredState.nested?.field).toBe(42);
      expect(recoveredState.deep?.nested?.field).toEqual({ data: 'test' });
    });

    it('should process DELETE operations correctly', async () => {
      // First set up some state
      const initialState = {
        ...mockState,
        test: 'value',
        nested: { field: 'value', keep: 'this' }
      } as any;

      const walEntries = [
        { op: 'DELETE', key: 'test' },
        { op: 'DELETE', key: 'nested.field' }
      ];

      mockWAL.replay.mockResolvedValue(undefined);
      mockWAL.getWALEntries.mockResolvedValue(walEntries);

      const result = await transactionRecovery.recoverFromWAL(initialState);

      const recoveredState = result.recoveredState as any;
      expect(recoveredState.test).toBeUndefined();
      expect(recoveredState.nested?.field).toBeUndefined();
      expect(recoveredState.nested?.keep).toBe('this'); // Should remain
    });

    it('should handle DELETE operations on non-existent paths', async () => {
      const walEntries = [
        { op: 'DELETE', key: 'non.existent.path' },
        { op: 'DELETE', key: 'another.missing.field' }
      ];

      mockWAL.replay.mockResolvedValue(undefined);
      mockWAL.getWALEntries.mockResolvedValue(walEntries);

      const result = await transactionRecovery.recoverFromWAL(mockState);

      // Should not throw and should complete successfully
      expect(result.recoveredTransactions).toBe(2);
    });

    it('should ignore transaction begin/commit operations', async () => {
      const walEntries = [
        { op: 'TRANSACTION_BEGIN', key: 'tx-123' },
        { op: 'SET', key: 'test.field', value: 'value' },
        { op: 'TRANSACTION_COMMIT', key: 'tx-123' }
      ];

      mockWAL.replay.mockResolvedValue(undefined);
      mockWAL.getWALEntries.mockResolvedValue(walEntries);

      const result = await transactionRecovery.recoverFromWAL(mockState);

      expect(result.recoveredTransactions).toBe(3);
      const recoveredState = result.recoveredState as any;
      expect(recoveredState.test?.field).toBe('value');
    });

    it('should warn about unknown operations', async () => {
      const walEntries = [
        { op: 'UNKNOWN_OP', key: 'test.field', value: 'value' },
        { op: 'ANOTHER_UNKNOWN', key: 'other.field' }
      ];

      mockWAL.replay.mockResolvedValue(undefined);
      mockWAL.getWALEntries.mockResolvedValue(walEntries);

      const result = await transactionRecovery.recoverFromWAL(mockState);

      expect(result.recoveredTransactions).toBe(2);
    });

    it('should skip SET operations with undefined values', async () => {
      const walEntries = [
        { op: 'SET', key: 'test.field' }, // No value
        { op: 'SET', key: 'other.field', value: undefined }
      ];

      mockWAL.replay.mockResolvedValue(undefined);
      mockWAL.getWALEntries.mockResolvedValue(walEntries);

      const result = await transactionRecovery.recoverFromWAL(mockState);

      const recoveredState = result.recoveredState as any;
      expect(recoveredState.test?.field).toBeUndefined();
      expect(recoveredState.other?.field).toBeUndefined();
    });
  });

  describe('state manipulation edge cases', () => {
    it('should create nested objects when applying SET to new paths', async () => {
      const walEntries = [
        { op: 'SET', key: 'deeply.nested.new.field', value: 'test-value' }
      ];

      mockWAL.replay.mockResolvedValue(undefined);
      mockWAL.getWALEntries.mockResolvedValue(walEntries);

      const result = await transactionRecovery.recoverFromWAL(mockState);

      const recoveredState = result.recoveredState as any;
      expect(recoveredState.deeply?.nested?.new?.field).toBe('test-value');
    });

    it('should handle single-level keys', async () => {
      const walEntries = [
        { op: 'SET', key: 'toplevel', value: 'value' },
        { op: 'DELETE', key: 'toplevel' }
      ];

      mockWAL.replay.mockResolvedValue(undefined);
      mockWAL.getWALEntries.mockResolvedValue(walEntries);

      const result = await transactionRecovery.recoverFromWAL(mockState);

      const recoveredState = result.recoveredState as any;
      expect(recoveredState.toplevel).toBeUndefined();
    });

    it('should preserve existing nested structure when modifying', async () => {
      const initialState = {
        ...mockState,
        existing: {
          keep: 'this',
          nested: {
            also: 'keep',
            modify: 'old-value'
          }
        }
      } as any;

      const walEntries = [
        { op: 'SET', key: 'existing.nested.modify', value: 'new-value' },
        { op: 'SET', key: 'existing.nested.add', value: 'added' }
      ];

      mockWAL.replay.mockResolvedValue(undefined);
      mockWAL.getWALEntries.mockResolvedValue(walEntries);

      const result = await transactionRecovery.recoverFromWAL(initialState);

      const recoveredState = result.recoveredState as any;
      expect(recoveredState.existing.keep).toBe('this');
      expect(recoveredState.existing.nested.also).toBe('keep');
      expect(recoveredState.existing.nested.modify).toBe('new-value');
      expect(recoveredState.existing.nested.add).toBe('added');
    });
  });

  describe('error handling and logging', () => {
    it('should handle WAL clear errors gracefully after successful recovery', async () => {
      const walEntries = [
        { op: 'SET', key: 'test.field', value: 'value' }
      ];

      mockWAL.replay.mockResolvedValue(undefined);
      mockWAL.getWALEntries.mockResolvedValue(walEntries);
      mockWAL.createBackup.mockResolvedValue(undefined);
      mockWAL.clear.mockRejectedValue(new Error('Clear failed'));

      const result = await transactionRecovery.recoverFromWAL(mockState);

      expect(result.recoveredTransactions).toBe(1);
    });

    it('should handle WAL backup errors gracefully', async () => {
      const walEntries = [
        { op: 'SET', key: 'test.field', value: 'value' }
      ];

      mockWAL.replay.mockResolvedValue(undefined);
      mockWAL.getWALEntries.mockResolvedValue(walEntries);
      mockWAL.createBackup.mockRejectedValue(new Error('Backup failed'));

      const result = await transactionRecovery.recoverFromWAL(mockState);

      expect(result.recoveredTransactions).toBe(1);
    });

    it('should log detailed information during recovery', async () => {
      const walEntries = [
        { op: 'SET', key: 'test.field', value: 'value' },
        { op: 'DELETE', key: 'other.field' }
      ];

      mockWAL.replay.mockResolvedValue(undefined);
      mockWAL.getWALEntries.mockResolvedValue(walEntries);

      const result = await transactionRecovery.recoverFromWAL(mockState);

      expect(result.recoveredTransactions).toBe(2);
    });
  });

  describe('complex recovery scenarios', () => {
    it('should handle large number of WAL entries', async () => {
      const walEntries = [];
      for (let i = 0; i < 1000; i++) {
        walEntries.push({ op: 'SET', key: `field${i}`, value: `value${i}` });
      }

      mockWAL.replay.mockResolvedValue(undefined);
      mockWAL.getWALEntries.mockResolvedValue(walEntries);

      const result = await transactionRecovery.recoverFromWAL(mockState);

      expect(result.recoveredTransactions).toBe(1000);
      const recoveredState = result.recoveredState as any;
      expect(recoveredState.field0).toBe('value0');
      expect(recoveredState.field999).toBe('value999');
    });

    it('should handle mixed SET and DELETE operations in sequence', async () => {
      const walEntries = [
        { op: 'SET', key: 'counter', value: 1 },
        { op: 'SET', key: 'counter', value: 2 },
        { op: 'SET', key: 'counter', value: 3 },
        { op: 'DELETE', key: 'counter' },
        { op: 'SET', key: 'counter', value: 4 }
      ];

      mockWAL.replay.mockResolvedValue(undefined);
      mockWAL.getWALEntries.mockResolvedValue(walEntries);

      const result = await transactionRecovery.recoverFromWAL(mockState);

      expect(result.recoveredTransactions).toBe(5);
      const recoveredState = result.recoveredState as any;
      expect(recoveredState.counter).toBe(4); // Final value after all operations
    });

    it('should handle recovery with various data types', async () => {
      const walEntries = [
        { op: 'SET', key: 'string', value: 'text' },
        { op: 'SET', key: 'number', value: 42 },
        { op: 'SET', key: 'boolean', value: true },
        { op: 'SET', key: 'array', value: [1, 2, 3] },
        { op: 'SET', key: 'object', value: { nested: 'value' } },
        { op: 'SET', key: 'null', value: null }
      ];

      mockWAL.replay.mockResolvedValue(undefined);
      mockWAL.getWALEntries.mockResolvedValue(walEntries);

      const result = await transactionRecovery.recoverFromWAL(mockState);

      const recoveredState = result.recoveredState as any;
      expect(recoveredState.string).toBe('text');
      expect(recoveredState.number).toBe(42);
      expect(recoveredState.boolean).toBe(true);
      expect(recoveredState.array).toEqual([1, 2, 3]);
      expect(recoveredState.object).toEqual({ nested: 'value' });
      expect(recoveredState.null).toBeNull();
    });
  });
});