import { join } from 'node:path';
import createDebug from 'debug';
import { WriteAheadLog } from './WriteAheadLog';
import { TransactionError } from './errors';
import { ChecklistState, Transaction, Operation } from './types';

const debug = createDebug('checklist:transaction');

export class TransactionCoordinator {
  private transactions: Map<string, Transaction> = new Map();
  private logPath: string;
  private wal: WriteAheadLog;
  private isRecovering = false;

  constructor(logDirectory: string) {
    this.logPath = join(logDirectory, 'audit.log');
    this.wal = new WriteAheadLog(logDirectory);
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
      throw new TransactionError(
        `Transaction ${transactionId} not found`,
        transactionId
      );
    }

    if (transaction.status !== 'active') {
      throw new TransactionError(
        `Transaction ${transactionId} is not active`,
        transactionId
      );
    }

    const operation: Operation = {
      id: crypto.randomUUID(),
      type,
      path,
      data,
      timestamp: new Date().toISOString(),
    };

    // Write to WAL before modifying state
    await this.wal.append({
      op: type === 'delete' ? 'delete' : 'write',
      key: path,
      value: data,
      transactionId,
    });

    transaction.operations.push(operation);
    await this.logTransaction('OPERATION', transactionId, operation);
    debug(
      'WAL entry added for operation %s in transaction %s',
      operation.id,
      transactionId
    );
  }

  async validateTransaction(
    transactionId: string,
    validator: (ops: Operation[]) => Promise<boolean>
  ): Promise<boolean> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new TransactionError(
        `Transaction ${transactionId} not found`,
        transactionId
      );
    }

    try {
      const isValid = await validator(transaction.operations);
      if (!isValid) {
        await this.logTransaction('VALIDATION_FAILED', transactionId);
      }
      return isValid;
    } catch (error) {
      await this.logTransaction('VALIDATION_ERROR', transactionId, {
        error: String(error),
      });
      return false;
    }
  }

  async commitTransaction(
    transactionId: string,
    applyChanges: (ops: Operation[]) => Promise<ChecklistState>
  ): Promise<ChecklistState> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new TransactionError(
        `Transaction ${transactionId} not found`,
        transactionId
      );
    }

    if (transaction.status !== 'active') {
      throw new TransactionError(
        `Transaction ${transactionId} is not active`,
        transactionId
      );
    }

    try {
      const newState = await applyChanges(transaction.operations);
      transaction.status = 'committed';

      await this.logTransaction('COMMIT', transactionId, {
        operationCount: transaction.operations.length,
        duration: Date.now() - transaction.startedAt.getTime(),
      });

      // Clear WAL after successful commit
      await this.wal.clear();
      debug(
        'WAL cleared after successful commit of transaction %s',
        transactionId
      );

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
      throw new TransactionError(
        `Transaction ${transactionId} not found`,
        transactionId
      );
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

  async getTransaction(
    transactionId: string
  ): Promise<Transaction | undefined> {
    return this.transactions.get(transactionId);
  }

  async getActiveTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).filter(
      (t) => t.status === 'active'
    );
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

      const logContent =
        existingLog.map((entry) => JSON.stringify(entry)).join('\n') + '\n';

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
        console.error(
          `Failed to rollback transaction ${transaction.id}:`,
          error
        );
      }
    }
    this.transactions.clear();
  }

  async recoverFromWAL(
    applyEntry: (entry: {
      op: string;
      key: string;
      value?: unknown;
    }) => Promise<void>
  ): Promise<number> {
    if (this.isRecovering) {
      debug('Recovery already in progress');
      return 0;
    }

    this.isRecovering = true;
    let recoveredCount = 0;

    try {
      // Check if WAL exists
      if (!(await this.wal.exists())) {
        debug('No WAL file found, skipping recovery');
        return 0;
      }

      // Create backup before recovery
      await this.wal.createBackup();
      debug('WAL backup created before recovery');

      // Replay WAL entries
      const entries = await this.wal.replay();
      debug('Found %d WAL entries to recover', entries.length);

      for (const entry of entries) {
        try {
          await applyEntry({
            op: entry.op,
            key: entry.key,
            value: entry.value,
          });
          recoveredCount++;
          debug('Recovered WAL entry: %O', entry);
        } catch (error) {
          console.error('Failed to apply WAL entry:', error);
          debug('Failed to recover entry: %O, error: %O', entry, error);
        }
      }

      // Clear WAL after successful recovery
      if (recoveredCount === entries.length) {
        await this.wal.clear();
        debug('WAL cleared after successful recovery');
      }

      await this.logTransaction('RECOVERY', 'wal-recovery', {
        entriesFound: entries.length,
        entriesRecovered: recoveredCount,
      });

      return recoveredCount;
    } catch (error) {
      console.error('WAL recovery failed:', error);
      debug('Recovery error: %O', error);
      throw new TransactionError(
        `WAL recovery failed: ${error}`,
        'wal-recovery'
      );
    } finally {
      this.isRecovering = false;
    }
  }

  async hasIncompleteTransactions(): Promise<boolean> {
    return await this.wal.exists();
  }

  async getWALSize(): Promise<number> {
    return await this.wal.size();
  }

  async rotateWAL(maxSize: number = 10 * 1024 * 1024): Promise<void> {
    await this.wal.rotate(maxSize);
  }
}
