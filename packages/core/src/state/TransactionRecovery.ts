/**
 * Transaction recovery operations
 * Handles recovery from WAL and transaction rollback scenarios
 */

import { createLogger } from '../utils/logger';
import { TransactionManager } from './TransactionManager';
import { WriteAheadLog } from './WriteAheadLog';
import { TransactionError } from './errors';
import { ChecklistState } from './types';

const logger = createLogger('checklist:transaction-recovery');

export class TransactionRecovery {
  constructor(
    private transactionManager: TransactionManager,
    private wal: WriteAheadLog
  ) {}

  async recoverFromWAL(
    currentState: ChecklistState
  ): Promise<{
    recoveredState: ChecklistState;
    recoveredTransactions: number;
  }> {
    try {
      logger.info({ msg: 'Starting WAL recovery' });
      const entries = await this.prepareWALRecovery();

      if (entries.length === 0) {
        logger.info({ msg: 'No WAL entries found for recovery' });
        return { recoveredState: currentState, recoveredTransactions: 0 };
      }

      const result = await this.executeWALRecovery(currentState, entries);
      await this.finalizeRecovery(entries.length, result.recoveredTransactions);

      return result;
    } catch (error) {
      logger.error({ msg: 'WAL recovery failed', error });
      throw new TransactionError(
        'Failed to recover from WAL',
        'WAL_RECOVERY_FAILED',
        { error: (error as Error).message }
      );
    }
  }

  async hasIncompleteTransactions(): Promise<boolean> {
    try {
      const entries = await this.wal.getWALEntries();
      return entries.length > 0;
    } catch (error) {
      logger.error({ msg: 'Failed to check for incomplete transactions', error });
      return false;
    }
  }

  async getWALSize(): Promise<number> {
    return await this.wal.getSize();
  }

  async rotateWAL(maxSize: number = 10 * 1024 * 1024): Promise<void> {
    const currentSize = await this.getWALSize();
    if (currentSize > maxSize) {
      logger.info({
        msg: 'Rotating WAL due to size',
        currentSize,
        maxSize,
      });
      await this.wal.rotate();
    }
  }

  private async prepareWALRecovery(): Promise<{ op: string; key: string; value?: unknown }[]> {
    try {
      return await this.wal.getWALEntries();
    } catch (error) {
      logger.error({ msg: 'Failed to read WAL entries', error });
      throw new TransactionError(
        'Cannot prepare WAL recovery',
        'WAL_READ_FAILED',
        { error: (error as Error).message }
      );
    }
  }

  private async executeWALRecovery(
    currentState: ChecklistState,
    entries: { op: string; key: string; value?: unknown }[]
  ): Promise<{
    recoveredState: ChecklistState;
    recoveredTransactions: number;
  }> {
    let recoveredState = { ...currentState };
    let recoveredCount = 0;

    for (const entry of entries) {
      try {
        recoveredState = await this.processWALEntry(recoveredState, entry);
        recoveredCount++;
      } catch (error) {
        logger.error({
          msg: 'Failed to process WAL entry',
          entry,
          error: (error as Error).message,
        });
        // Continue with next entry rather than failing entire recovery
      }
    }

    return {
      recoveredState,
      recoveredTransactions: recoveredCount,
    };
  }

  private async processWALEntry(
    currentState: ChecklistState,
    entry: { op: string; key: string; value?: unknown }
  ): Promise<ChecklistState> {
    const { op, key, value } = entry;

    logger.debug({
      msg: 'Processing WAL entry',
      operation: op,
      key,
      hasValue: value !== undefined,
    });

    // Apply operation based on type
    const newState = { ...currentState };

    switch (op) {
      case 'SET':
        if (value !== undefined) {
          // Apply the state change
          this.applyStateChange(newState, key, value);
        }
        break;

      case 'DELETE':
        this.applyStateDeletion(newState, key);
        break;

      case 'TRANSACTION_BEGIN':
        // Transaction metadata, no state change needed
        break;

      case 'TRANSACTION_COMMIT':
        // Transaction finalization, no additional state change
        break;

      default:
        logger.warn({ msg: 'Unknown WAL operation', operation: op, key });
    }

    return newState;
  }

  private applyStateChange(state: ChecklistState, key: string, value: unknown): void {
    const keyPath = key.split('.');
    let current: Record<string, unknown> = state as Record<string, unknown>;

    // Navigate to the parent object
    for (let i = 0; i < keyPath.length - 1; i++) {
      const part = keyPath[i];
      if (current[part] === undefined) {
        current[part] = {};
      }
      current = current[part];
    }

    // Set the final value
    const finalKey = keyPath[keyPath.length - 1];
    current[finalKey] = value;
  }

  private applyStateDeletion(state: ChecklistState, key: string): void {
    const keyPath = key.split('.');
    let current: Record<string, unknown> = state as Record<string, unknown>;

    // Navigate to the parent object
    for (let i = 0; i < keyPath.length - 1; i++) {
      const part = keyPath[i];
      if (current[part] === undefined) {
        return; // Path doesn't exist, nothing to delete
      }
      current = current[part];
    }

    // Delete the final key
    const finalKey = keyPath[keyPath.length - 1];
    delete current[finalKey];
  }

  private async finalizeRecovery(totalEntries: number, recoveredCount: number): Promise<void> {
    logger.info({
      msg: 'WAL recovery completed',
      totalEntries,
      recoveredEntries: recoveredCount,
      failedEntries: totalEntries - recoveredCount,
    });

    if (recoveredCount > 0) {
      // Clear WAL after successful recovery
      try {
        await this.wal.clear();
        logger.info({ msg: 'WAL cleared after successful recovery' });
      } catch (error) {
        logger.warn({ msg: 'Failed to clear WAL after recovery', error });
      }
    }
  }
}