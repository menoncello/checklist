import { ChecklistState, Transaction, Operation } from './types';
import { TransactionError } from './errors';
import { join } from 'node:path';

export class TransactionCoordinator {
  private transactions: Map<string, Transaction> = new Map();
  private logPath: string;

  constructor(logDirectory: string) {
    this.logPath = join(logDirectory, 'audit.log');
    this.setupLogRotation();
  }

  async beginTransaction(currentState: ChecklistState): Promise<string> {
    const transactionId = crypto.randomUUID();
    const transaction: Transaction = {
      id: transactionId,
      startedAt: new Date(),
      operations: [],
      snapshot: structuredClone(currentState),
      status: 'active',
    };

    this.transactions.set(transactionId, transaction);
    await this.logTransaction('BEGIN', transactionId, { snapshot: true });

    return transactionId;
  }

  async addOperation(
    transactionId: string,
    type: string,
    path: string,
    data?: unknown
  ): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new TransactionError(`Transaction ${transactionId} not found`, transactionId);
    }

    if (transaction.status !== 'active') {
      throw new TransactionError(`Transaction ${transactionId} is not active`, transactionId);
    }

    const operation: Operation = {
      id: crypto.randomUUID(),
      type,
      path,
      data,
      timestamp: new Date().toISOString(),
    };

    transaction.operations.push(operation);
    await this.logTransaction('OPERATION', transactionId, operation);
  }

  async validateTransaction(
    transactionId: string,
    validator: (ops: Operation[]) => Promise<boolean>
  ): Promise<boolean> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new TransactionError(`Transaction ${transactionId} not found`, transactionId);
    }

    try {
      const isValid = await validator(transaction.operations);
      if (!isValid) {
        await this.logTransaction('VALIDATION_FAILED', transactionId);
      }
      return isValid;
    } catch (error) {
      await this.logTransaction('VALIDATION_ERROR', transactionId, { error: String(error) });
      return false;
    }
  }

  async commitTransaction(
    transactionId: string,
    applyChanges: (ops: Operation[]) => Promise<ChecklistState>
  ): Promise<ChecklistState> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new TransactionError(`Transaction ${transactionId} not found`, transactionId);
    }

    if (transaction.status !== 'active') {
      throw new TransactionError(`Transaction ${transactionId} is not active`, transactionId);
    }

    try {
      const newState = await applyChanges(transaction.operations);
      transaction.status = 'committed';

      await this.logTransaction('COMMIT', transactionId, {
        operationCount: transaction.operations.length,
        duration: Date.now() - transaction.startedAt.getTime(),
      });

      this.transactions.delete(transactionId);
      return newState;
    } catch (error) {
      await this.rollbackTransaction(transactionId);
      throw new TransactionError(
        `Failed to commit transaction ${transactionId}: ${error}`,
        transactionId
      );
    }
  }

  async rollbackTransaction(transactionId: string): Promise<ChecklistState> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new TransactionError(`Transaction ${transactionId} not found`, transactionId);
    }

    transaction.status = 'rolled-back';
    const restoredState = structuredClone(transaction.snapshot);

    await this.logTransaction('ROLLBACK', transactionId, {
      operationCount: transaction.operations.length,
      reason: 'Transaction rolled back',
    });

    this.transactions.delete(transactionId);
    return restoredState;
  }

  async getTransaction(transactionId: string): Promise<Transaction | undefined> {
    return this.transactions.get(transactionId);
  }

  async getActiveTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).filter((t) => t.status === 'active');
  }

  private async logTransaction(
    action: string,
    transactionId: string,
    details?: unknown
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      transactionId,
      details,
      stackTrace: action.includes('ERROR') ? new Error().stack : undefined,
    };

    try {
      const existingLog = await this.readLog();
      existingLog.push(logEntry);

      const logContent = existingLog.map((entry) => JSON.stringify(entry)).join('\n') + '\n';

      await Bun.write(this.logPath, logContent);
    } catch (error) {
      console.error('Failed to write to audit log:', error);
    }
  }

  private async readLog(): Promise<unknown[]> {
    try {
      const file = Bun.file(this.logPath);
      if (!(await file.exists())) {
        return [];
      }

      const content = await file.text();
      return content
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  private setupLogRotation(): void {
    const rotationInterval = 24 * 60 * 60 * 1000;
    const maxLogSize = 10 * 1024 * 1024;

    setInterval(async () => {
      try {
        const file = Bun.file(this.logPath);
        if (!(await file.exists())) return;

        const size = file.size;
        if (size > maxLogSize) {
          await this.rotateLog();
        }
      } catch (error) {
        console.error('Log rotation check failed:', error);
      }
    }, rotationInterval);
  }

  private async rotateLog(): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archivePath = this.logPath.replace('.log', `-${timestamp}.log`);

      const currentContent = await Bun.file(this.logPath).text();
      await Bun.write(archivePath, currentContent);
      await Bun.write(this.logPath, '');
    } catch (error) {
      console.error('Failed to rotate log:', error);
    }
  }

  async cleanup(): Promise<void> {
    const activeTransactions = await this.getActiveTransactions();
    for (const transaction of activeTransactions) {
      try {
        await this.rollbackTransaction(transaction.id);
      } catch (error) {
        console.error(`Failed to rollback transaction ${transaction.id}:`, error);
      }
    }
    this.transactions.clear();
  }
}
