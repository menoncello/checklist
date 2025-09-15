import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { hostname, userInfo } from 'node:os';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import { createLogger } from '../utils/logger';
import {
  LOCK_TIMEOUT,
  LOCK_RETRY_INTERVAL,
  LOCK_EXPIRY_TIME,
} from './constants';
import { LockAcquisitionError } from './errors';
import { LockFile } from './types';

export class ConcurrencyManager {
  private lockDir: string;
  private lockId?: string;
  private renewalTimer?: Timer;
  private readonly pid: number;
  private readonly ppid?: number;
  private logger = createLogger('checklist:concurrency');

  constructor(lockDirectory: string) {
    this.lockDir = lockDirectory;
    this.pid = process.pid;
    this.ppid = process.ppid;

    if (!existsSync(this.lockDir)) {
      mkdirSync(this.lockDir, { recursive: true });
    }

    process.on('exit', () => this.releaseLock());
    process.on('SIGINT', () => this.releaseLock());
    process.on('SIGTERM', () => this.releaseLock());
  }

  async acquireLock(
    lockName: string = 'state',
    timeout: number = LOCK_TIMEOUT
  ): Promise<string> {
    const lockPath = this.getLockPath(lockName);
    const startTime = Date.now();
    const lockUuid = crypto.randomUUID();

    while (Date.now() - startTime < timeout) {
      try {
        if (await this.tryAcquireLock(lockPath, lockUuid)) {
          this.lockId = lockUuid;
          this.startHeartbeat(lockPath, lockUuid);
          return lockUuid;
        }
      } catch {
        if (await this.isLockStale(lockPath)) {
          await this.cleanupStaleLock(lockPath);
          continue;
        }
      }

      await this.addToWaitingQueue(lockPath);
      await Bun.sleep(LOCK_RETRY_INTERVAL);
    }

    throw new LockAcquisitionError(
      `Failed to acquire lock ${lockName} after ${timeout}ms`,
      timeout
    );
  }

  private async tryAcquireLock(
    lockPath: string,
    lockId: string
  ): Promise<boolean> {
    try {
      if (await this.lockFileExists(lockPath)) {
        return false;
      }

      const lockFile = this.createLockFileData(lockId);
      return await this.writeLockFileAtomically(lockPath, lockFile, lockId);
    } catch {
      return false;
    }
  }

  /**
   * Check if lock file exists
   */
  private async lockFileExists(lockPath: string): Promise<boolean> {
    const file = Bun.file(lockPath);
    return await file.exists();
  }

  /**
   * Create lock file data structure
   */
  private createLockFileData(lockId: string): LockFile {
    return {
      version: '1.0.0',
      lockId,
      metadata: {
        pid: this.pid,
        ppid: this.ppid,
        hostname: hostname(),
        user: userInfo().username,
      },
      timing: {
        acquiredAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + LOCK_EXPIRY_TIME).toISOString(),
      },
      operation: {
        type: 'write',
        stackTrace: new Error().stack,
      },
      concurrency: {
        waitingProcesses: [],
      },
    };
  }

  /**
   * Write lock file atomically and verify
   */
  private async writeLockFileAtomically(
    lockPath: string,
    lockFile: LockFile,
    lockId: string
  ): Promise<boolean> {
    const lockContent = yaml.dump(lockFile);
    await Bun.write(lockPath, lockContent, { createPath: false });

    const writtenContent = await Bun.file(lockPath).text();
    const writtenLock = yaml.load(writtenContent) as LockFile;

    return writtenLock.lockId === lockId;
  }

  private startHeartbeat(lockPath: string, lockId: string): void {
    const renewalInterval = LOCK_EXPIRY_TIME / 3;

    this.renewalTimer = setInterval(async () => {
      try {
        const lockContent = await Bun.file(lockPath).text();
        const lockFile = yaml.load(lockContent) as LockFile;

        if (lockFile.lockId === lockId) {
          lockFile.timing.renewedAt = new Date().toISOString();
          lockFile.timing.expiresAt = new Date(
            Date.now() + LOCK_EXPIRY_TIME
          ).toISOString();

          await Bun.write(lockPath, yaml.dump(lockFile));
        }
      } catch {
        // Ignore errors during renewal
      }
    }, renewalInterval);
  }

  async releaseLock(lockName: string = 'state'): Promise<void> {
    if (this.lockId === undefined || this.lockId === null || this.lockId === '')
      return;

    const lockPath = this.getLockPath(lockName);

    if (this.renewalTimer) {
      clearInterval(this.renewalTimer);
      this.renewalTimer = undefined;
    }

    try {
      const lockContent = await Bun.file(lockPath).text();
      const lockFile = yaml.load(lockContent) as LockFile;

      if (lockFile.lockId === this.lockId) {
        unlinkSync(lockPath);
      }
    } catch (error) {
      // Only log in non-test environments to prevent noise
      if (Bun.env.NODE_ENV !== 'test') {
        this.logger.error({ msg: 'Error releasing lock', error });
      }
    } finally {
      this.lockId = undefined;
    }
  }

  private async isLockStale(lockPath: string): Promise<boolean> {
    try {
      const lockContent = await Bun.file(lockPath).text();
      const lockFile = yaml.load(lockContent) as LockFile;

      const expiresAt = new Date(lockFile.timing.expiresAt);
      if (Date.now() > expiresAt.getTime()) {
        return true;
      }

      if (lockFile.metadata.pid === this.pid) {
        return false;
      }

      try {
        process.kill(lockFile.metadata.pid, 0);
        return false;
      } catch {
        return true;
      }
    } catch {
      return false;
    }
  }

  private async cleanupStaleLock(lockPath: string): Promise<void> {
    try {
      unlinkSync(lockPath);
    } catch (error) {
      this.logger.error({ msg: 'Failed to cleanup stale lock', error });
    }
  }

  private async addToWaitingQueue(lockPath: string): Promise<void> {
    try {
      const lockContent = await Bun.file(lockPath).text();
      const lockFile = yaml.load(lockContent) as LockFile;

      const alreadyWaiting = lockFile.concurrency.waitingProcesses.some(
        (p) => p.pid === this.pid
      );

      if (!alreadyWaiting) {
        lockFile.concurrency.waitingProcesses.push({
          pid: this.pid,
          since: new Date().toISOString(),
        });

        await Bun.write(lockPath, yaml.dump(lockFile));
      }
    } catch {
      // Ignore errors updating waiting queue
    }
  }

  private getLockPath(lockName: string): string {
    return join(this.lockDir, `${lockName}.lock`);
  }

  async isLocked(lockName: string = 'state'): Promise<boolean> {
    const lockPath = this.getLockPath(lockName);
    return existsSync(lockPath) && !(await this.isLockStale(lockPath));
  }

  async getLockInfo(lockName: string = 'state'): Promise<LockFile | null> {
    const lockPath = this.getLockPath(lockName);

    try {
      const lockContent = await Bun.file(lockPath).text();
      return yaml.load(lockContent) as LockFile;
    } catch {
      return null;
    }
  }

  async withLock<T>(lockName: string, operation: () => Promise<T>): Promise<T> {
    const lockId = await this.acquireLock(lockName);
    try {
      return await operation();
    } finally {
      await this.releaseLock(lockId);
    }
  }
}
