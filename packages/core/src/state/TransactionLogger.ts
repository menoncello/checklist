/**
 * Transaction logging and audit functionality
 * Handles transaction event logging and log rotation
 */

import { writeFile, appendFile, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger } from '../utils/logger';
import { Operation } from './types';

const logger = createLogger('checklist:transaction-logger');

export class TransactionLogger {
  private logPath: string;
  private rotationTimer: Timer | null = null;

  constructor(logDirectory: string) {
    this.logPath = join(logDirectory, 'audit.log');
    this.setupLogRotation();
  }

  async logTransaction(
    action: 'BEGIN' | 'COMMIT' | 'ROLLBACK',
    transactionId: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      transactionId,
      metadata,
    };

    try {
      await appendFile(this.logPath, `${JSON.stringify(logEntry)}\n`);
      logger.debug({
        msg: 'Transaction logged',
        action,
        transactionId,
        hasMetadata: Object.keys(metadata).length > 0,
      });
    } catch (error) {
      logger.error({
        msg: 'Failed to log transaction',
        action,
        transactionId,
        error,
      });
    }
  }

  async logOperation(
    operation: Operation,
    transactionId: string
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action: 'OPERATION',
      transactionId,
      operation: {
        id: operation.id,
        type: operation.type,
        path: operation.path,
        hasData: operation.data !== undefined,
      },
    };

    try {
      await appendFile(this.logPath, `${JSON.stringify(logEntry)}\n`);
      logger.debug({
        msg: 'Operation logged',
        operationId: operation.id,
        type: operation.type,
        transactionId,
      });
    } catch (error) {
      logger.error({
        msg: 'Failed to log operation',
        operationId: operation.id,
        transactionId,
        error,
      });
    }
  }

  async readLog(): Promise<unknown[]> {
    try {
      const content = await readFile(this.logPath, 'utf-8');
      const lines = content
        .trim()
        .split('\n')
        .filter((line) => line.length > 0);

      return lines
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch (_parseError) {
            logger.warn({ msg: 'Failed to parse log line', line });
            return null;
          }
        })
        .filter((entry) => entry !== null);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Log file doesn't exist yet, return empty array
        return [];
      }
      logger.error({ msg: 'Failed to read transaction log', error });
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (this.rotationTimer !== null) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
    logger.debug({ msg: 'Transaction logger cleanup completed' });
  }

  private setupLogRotation(): void {
    // Rotate log every hour
    this.rotationTimer = setInterval(
      () => {
        this.rotateLogIfNeeded().catch((error) => {
          logger.error({ msg: 'Log rotation failed', error });
        });
      },
      60 * 60 * 1000
    );
  }

  private async rotateLogIfNeeded(): Promise<void> {
    try {
      const stats = await stat(this.logPath);
      const maxSize = 10 * 1024 * 1024; // 10MB

      if (stats.size > maxSize) {
        await this.rotateLog();
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error({ msg: 'Failed to check log size', error });
      }
    }
  }

  private async rotateLog(): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedPath = `${this.logPath}.${timestamp}`;

      // Read current log content
      let content = '';
      try {
        content = await readFile(this.logPath, 'utf-8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          // Log file doesn't exist, nothing to rotate
          return;
        }
        throw error;
      }

      // Write to rotated file
      await writeFile(rotatedPath, content);

      // Clear current log
      await writeFile(this.logPath, '');

      logger.info({
        msg: 'Transaction log rotated',
        rotatedFile: rotatedPath,
        originalSize: content.length,
      });
    } catch (error) {
      logger.error({ msg: 'Log rotation failed', error });
      throw error;
    }
  }
}
