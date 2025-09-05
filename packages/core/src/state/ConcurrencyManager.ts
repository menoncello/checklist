import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { hostname, userInfo } from 'node:os';
import { LockFile } from './types';
import { LockAcquisitionError } from './errors';
import { LOCK_TIMEOUT, LOCK_RETRY_INTERVAL, LOCK_EXPIRY_TIME } from './constants';
import * as yaml from 'js-yaml';

export class ConcurrencyManager {
  private lockDir: string;
  private lockId?: string;
  private renewalTimer?: Timer;
  private readonly pid: number;
  private readonly ppid?: number;

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

  async acquireLock(lockName: string = 'state', timeout: number = LOCK_TIMEOUT): Promise<string> {
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

  private async tryAcquireLock(lockPath: string, lockId: string): Promise<boolean> {
    try {
      const lockFile: LockFile = {
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

      const lockContent = yaml.dump(lockFile);

      const file = Bun.file(lockPath);
      if (await file.exists()) {
        return false;
      }

      await Bun.write(lockPath, lockContent, { createPath: false });

      const writtenContent = await Bun.file(lockPath).text();
      const writtenLock = yaml.load(writtenContent) as LockFile;

      return writtenLock.lockId === lockId;
    } catch {
      return false;
    }
  }

  private startHeartbeat(lockPath: string, lockId: string): void {
    const renewalInterval = LOCK_EXPIRY_TIME / 3;

    this.renewalTimer = setInterval(async () => {
      try {
        const lockContent = await Bun.file(lockPath).text();
        const lockFile = yaml.load(lockContent) as LockFile;

        if (lockFile.lockId === lockId) {
          lockFile.timing.renewedAt = new Date().toISOString();
          lockFile.timing.expiresAt = new Date(Date.now() + LOCK_EXPIRY_TIME).toISOString();

          await Bun.write(lockPath, yaml.dump(lockFile));
        }
      } catch {
        // Ignore errors during renewal
      }
    }, renewalInterval);
  }

  async releaseLock(lockName: string = 'state'): Promise<void> {
    if (!this.lockId) return;

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
      console.error('Error releasing lock:', error);
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
      console.error('Failed to cleanup stale lock:', error);
    }
  }

  private async addToWaitingQueue(lockPath: string): Promise<void> {
    try {
      const lockContent = await Bun.file(lockPath).text();
      const lockFile = yaml.load(lockContent) as LockFile;

      const alreadyWaiting = lockFile.concurrency.waitingProcesses.some((p) => p.pid === this.pid);

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
}
