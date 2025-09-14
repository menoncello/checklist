/**
 * Core transaction management functionality
 * Handles transaction lifecycle and validation
 */

import { createLogger } from '../utils/logger';
import { TransactionError } from './errors';
import { ChecklistState, Transaction, Operation } from './types';

const logger = createLogger('checklist:transaction-manager');

export class TransactionManager {
  private transactions: Map<string, Transaction> = new Map();

  beginTransaction(currentState: ChecklistState): string {
    const transactionId = crypto.randomUUID();
    const transaction: Transaction = {
      id: transactionId,
      startedAt: new Date(),
      operations: [],
      snapshot: structuredClone(currentState),
      status: 'active',
    };

    this.transactions.set(transactionId, transaction);
    logger.debug({ msg: 'Transaction begun', transactionId });
    return transactionId;
  }

  addOperation(
    transactionId: string,
    type: string,
    path: string,
    data?: unknown
  ): Operation {
    const transaction = this.validateActiveTransaction(transactionId);
    const operation = this.createOperation(type, path, data);

    transaction.operations.push(operation);
    logger.debug({
      msg: 'Operation added to transaction',
      transactionId,
      operationType: type,
      path
    });

    return operation;
  }

  validateTransaction(transactionId: string, expectedOperations?: number): void {
    const transaction = this.getTransaction(transactionId);

    if (transaction.status !== 'active') {
      throw new TransactionError(
        `Cannot validate ${transaction.status} transaction`,
        'TRANSACTION_NOT_ACTIVE',
        { transactionId, status: transaction.status }
      );
    }

    if (expectedOperations !== undefined && transaction.operations.length !== expectedOperations) {
      throw new TransactionError(
        `Transaction operation count mismatch. Expected: ${expectedOperations}, Actual: ${transaction.operations.length}`,
        'OPERATION_COUNT_MISMATCH',
        { transactionId, expected: expectedOperations, actual: transaction.operations.length }
      );
    }

    this.validateOperationConsistency(transaction);
  }

  commitTransaction(transactionId: string): Transaction {
    const transaction = this.validateTransactionForCommit(transactionId);
    transaction.status = 'committed';
    transaction.committedAt = new Date();

    logger.info({
      msg: 'Transaction committed',
      transactionId,
      operationCount: transaction.operations.length,
      duration: transaction.committedAt.getTime() - transaction.startedAt.getTime()
    });

    return transaction;
  }

  rollbackTransaction(transactionId: string): ChecklistState {
    const transaction = this.getTransaction(transactionId);
    transaction.status = 'aborted';
    transaction.committedAt = new Date();

    const snapshot = transaction.snapshot;
    this.transactions.delete(transactionId);

    logger.info({
      msg: 'Transaction rolled back',
      transactionId,
      operationCount: transaction.operations.length
    });

    return snapshot;
  }

  getTransaction(transactionId: string): Transaction {
    const transaction = this.transactions.get(transactionId);
    if (transaction === undefined) {
      throw new TransactionError(
        `Transaction not found: ${transactionId}`,
        'TRANSACTION_NOT_FOUND',
        { transactionId }
      );
    }
    return transaction;
  }

  getActiveTransactions(): Transaction[] {
    return Array.from(this.transactions.values()).filter(t => t.status === 'active');
  }

  hasTransaction(transactionId: string): boolean {
    return this.transactions.has(transactionId);
  }

  removeTransaction(transactionId: string): void {
    this.transactions.delete(transactionId);
  }

  cleanup(): void {
    const activeTransactions = this.getActiveTransactions();
    for (const transaction of activeTransactions) {
      logger.warn({
        msg: 'Cleaning up active transaction',
        transactionId: transaction.id,
        operationCount: transaction.operations.length,
      });
      transaction.status = 'aborted';
    }
    this.transactions.clear();
  }

  private validateActiveTransaction(transactionId: string): Transaction {
    const transaction = this.getTransaction(transactionId);

    if (transaction.status !== 'active') {
      throw new TransactionError(
        `Transaction is not active: ${transactionId} (status: ${transaction.status})`,
        'TRANSACTION_NOT_ACTIVE',
        { transactionId, status: transaction.status }
      );
    }

    return transaction;
  }

  private createOperation(type: string, path: string, data?: unknown): Operation {
    return {
      id: crypto.randomUUID(),
      type,
      path,
      data,
      timestamp: new Date(),
    };
  }

  private validateTransactionForCommit(transactionId: string): Transaction {
    const transaction = this.validateActiveTransaction(transactionId);

    if (transaction.operations.length === 0) {
      throw new TransactionError(
        'Cannot commit transaction with no operations',
        'EMPTY_TRANSACTION',
        { transactionId }
      );
    }

    return transaction;
  }

  private validateOperationConsistency(transaction: Transaction): void {
    const pathCounts = new Map<string, number>();

    for (const operation of transaction.operations) {
      const count = pathCounts.get(operation.path) ?? 0;
      pathCounts.set(operation.path, count + 1);
    }

    for (const [path, count] of pathCounts) {
      if (count > 1) {
        logger.warn({
          msg: 'Multiple operations on same path detected',
          transactionId: transaction.id,
          path,
          count,
        });
      }
    }
  }
}