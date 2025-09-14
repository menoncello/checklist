/**
 * Transaction coordinator with composition-based architecture
 * Orchestrates transaction management, logging, and recovery operations
 */

import { createLogger } from '../utils/logger';
import { TransactionLogger } from './TransactionLogger';
import { TransactionManager } from './TransactionManager';
import { TransactionRecovery } from './TransactionRecovery';
import { WriteAheadLog } from './WriteAheadLog';
import { TransactionError } from './errors';
import { ChecklistState, Transaction, Operation } from './types';

const logger = createLogger('checklist:transaction-coordinator');

export class TransactionCoordinator {
  private isRecovering = false;

  // Composed services
  private transactionManager: TransactionManager;
  private recovery: TransactionRecovery;
  private transactionLogger: TransactionLogger;
  private wal: WriteAheadLog;

  constructor(logDirectory: string) {
    this.wal = new WriteAheadLog(logDirectory);
    this.transactionManager = new TransactionManager();
    this.recovery = new TransactionRecovery(this.transactionManager, this.wal);
    this.transactionLogger = new TransactionLogger(logDirectory);
  }

  async beginTransaction(currentState: ChecklistState): Promise<string> {
    const transactionId =
      this.transactionManager.beginTransaction(currentState);
    await this.transactionLogger.logTransaction('BEGIN', transactionId, {
      snapshot: true,
    });
    return transactionId;
  }

  async addOperation(
    transactionId: string,
    type: string,
    path: string,
    data?: unknown
  ): Promise<void> {
    const operation = this.transactionManager.addOperation(
      transactionId,
      type,
      path,
      data
    );
    await this.persistOperation(operation, transactionId);
    await this.transactionLogger.logOperation(operation, transactionId);
  }

  async validateTransaction(
    transactionId: string,
    expectedOperations?: number
  ): Promise<void> {
    this.transactionManager.validateTransaction(
      transactionId,
      expectedOperations
    );
  }

  async commitTransaction(
    transactionId: string,
    stateValidator?: (transaction: Transaction) => Promise<void>
  ): Promise<void> {
    const transaction =
      this.transactionManager.commitTransaction(transactionId);

    try {
      if (stateValidator !== undefined) {
        await this.executeCommitPhase(transaction, stateValidator);
      }
      await this.finalizeCommit(transactionId, transaction);
    } catch (error) {
      // If commit fails, rollback the transaction
      await this.rollbackTransaction(transactionId);
      throw error;
    }
  }

  async rollbackTransaction(transactionId: string): Promise<ChecklistState> {
    const snapshot = this.transactionManager.rollbackTransaction(transactionId);
    await this.transactionLogger.logTransaction('ROLLBACK', transactionId);
    return snapshot;
  }

  async getTransaction(transactionId: string): Promise<Transaction | null> {
    try {
      return this.transactionManager.getTransaction(transactionId);
    } catch (error) {
      if (
        error instanceof TransactionError &&
        error.code === 'TRANSACTION_NOT_FOUND'
      ) {
        return null;
      }
      throw error;
    }
  }

  async getActiveTransactions(): Promise<Transaction[]> {
    return this.transactionManager.getActiveTransactions();
  }

  async recoverFromWAL(currentState: ChecklistState): Promise<{
    recoveredState: ChecklistState;
    recoveredTransactions: number;
  }> {
    this.isRecovering = true;
    try {
      return await this.recovery.recoverFromWAL(currentState);
    } finally {
      this.isRecovering = false;
    }
  }

  async hasIncompleteTransactions(): Promise<boolean> {
    return await this.recovery.hasIncompleteTransactions();
  }

  async getWALSize(): Promise<number> {
    return await this.recovery.getWALSize();
  }

  async rotateWAL(maxSize: number = 10 * 1024 * 1024): Promise<void> {
    await this.recovery.rotateWAL(maxSize);
  }

  async getWALEntries(): Promise<
    { op: string; key: string; value?: unknown }[]
  > {
    return await this.wal.getWALEntries();
  }

  async cleanup(): Promise<void> {
    logger.info({ msg: 'Starting transaction coordinator cleanup' });

    this.transactionManager.cleanup();
    await this.transactionLogger.cleanup();

    logger.info({ msg: 'Transaction coordinator cleanup completed' });
  }

  private async persistOperation(
    operation: Operation,
    transactionId: string
  ): Promise<void> {
    try {
      await this.wal.writeEntry({
        op: operation.type as 'write' | 'delete',
        key: operation.path,
        value: operation.data,
      });
    } catch (error) {
      logger.error({
        msg: 'Failed to persist operation to WAL',
        transactionId,
        operationId: operation.id,
        error,
      });
      throw new TransactionError('Failed to persist operation', transactionId);
    }
  }

  private async executeCommitPhase(
    transaction: Transaction,
    stateValidator: (transaction: Transaction) => Promise<void>
  ): Promise<void> {
    try {
      await stateValidator(transaction);
      logger.debug({
        msg: 'Transaction validation passed',
        transactionId: transaction.id,
        operationCount: transaction.operations.length,
      });
    } catch (error) {
      logger.error({
        msg: 'Transaction validation failed during commit',
        transactionId: transaction.id,
        error,
      });
      throw new TransactionError(
        'Transaction validation failed',
        transaction.id
      );
    }
  }

  private async finalizeCommit(
    transactionId: string,
    transaction: Transaction
  ): Promise<void> {
    this.transactionManager.removeTransaction(transactionId);
    await this.clearWALAfterCommit(transactionId);
    await this.transactionLogger.logTransaction('COMMIT', transactionId, {
      operationCount: transaction.operations.length,
      duration:
        (transaction.committedAt?.getTime() ?? 0) -
        transaction.startedAt.getTime(),
    });
  }

  private async clearWALAfterCommit(transactionId: string): Promise<void> {
    try {
      await this.wal.clear();
      logger.debug({ msg: 'WAL entries cleared after commit', transactionId });
    } catch (error) {
      logger.warn({
        msg: 'Failed to clear WAL entries after commit',
        transactionId,
        error,
      });
    }
  }
}
