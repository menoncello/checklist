import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ConcurrencyManager } from './ConcurrencyManager';
import { LockAcquisitionError } from './errors';

describe('ConcurrencyManager', () => {
  const testLockDir = '.test-locks';
  let manager1: ConcurrencyManager;
  let manager2: ConcurrencyManager;

  beforeEach(() => {
    if (existsSync(testLockDir)) {
      rmSync(testLockDir, { recursive: true, force: true });
    }
    manager1 = new ConcurrencyManager(testLockDir);
    manager2 = new ConcurrencyManager(testLockDir);
  });

  afterEach(async () => {
    await manager1.releaseLock();
    await manager2.releaseLock();
    if (existsSync(testLockDir)) {
      rmSync(testLockDir, { recursive: true, force: true });
    }
  });

  describe('Lock Acquisition', () => {
    it('should acquire lock successfully', async () => {
      const lockId = await manager1.acquireLock('test', 1000);
      expect(lockId).toBeDefined();
      expect(typeof lockId).toBe('string');
    });

    it('should prevent concurrent lock acquisition', async () => {
      await manager1.acquireLock('test', 1000);

      await expect(manager2.acquireLock('test', 500)).rejects.toThrow(LockAcquisitionError);
    });

    it('should allow different lock names', async () => {
      const lock1 = await manager1.acquireLock('lock1', 1000);
      const lock2 = await manager2.acquireLock('lock2', 1000);

      expect(lock1).toBeDefined();
      expect(lock2).toBeDefined();
      expect(lock1).not.toEqual(lock2);
    });

    it('should timeout when lock is unavailable', async () => {
      await manager1.acquireLock('test', 1000);

      const start = Date.now();
      await expect(manager2.acquireLock('test', 200)).rejects.toThrow(LockAcquisitionError);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(190);
      expect(duration).toBeLessThan(300);
    });
  });

  describe('Lock Release', () => {
    it('should release lock properly', async () => {
      await manager1.acquireLock('test', 1000);
      await manager1.releaseLock('test');

      const lock2 = await manager2.acquireLock('test', 1000);
      expect(lock2).toBeDefined();
    });

    it('should handle multiple release calls gracefully', async () => {
      await manager1.acquireLock('test', 1000);
      await manager1.releaseLock('test');
      await manager1.releaseLock('test');

      expect(await manager1.isLocked('test')).toBe(false);
    });

    it('should not release lock owned by different process', async () => {
      await manager1.acquireLock('test', 1000);
      await manager2.releaseLock('test');

      expect(await manager1.isLocked('test')).toBe(true);
    });
  });

  describe('Lock State', () => {
    it('should correctly report lock status', async () => {
      expect(await manager1.isLocked('test')).toBe(false);

      await manager1.acquireLock('test', 1000);
      expect(await manager1.isLocked('test')).toBe(true);

      await manager1.releaseLock('test');
      expect(await manager1.isLocked('test')).toBe(false);
    });

    it('should provide lock information', async () => {
      const lockId = await manager1.acquireLock('test', 1000);
      const info = await manager1.getLockInfo('test');

      expect(info).toBeDefined();
      expect(info?.lockId).toEqual(lockId);
      expect(info?.metadata.pid).toEqual(process.pid);
      expect(info?.metadata.hostname).toBeDefined();
    });

    it('should return null for non-existent locks', async () => {
      const info = await manager1.getLockInfo('nonexistent');
      expect(info).toBeNull();
    });
  });

  describe('Stale Lock Detection', () => {
    it.skip('should detect and cleanup stale locks', async () => {
      const staleLockPath = join(testLockDir, 'stale.lock');
      const staleLock = {
        version: '1.0.0',
        lockId: 'stale-lock-id',
        metadata: {
          pid: 99999999,
          hostname: 'test-host',
          user: 'test-user',
        },
        timing: {
          acquiredAt: new Date(Date.now() - 60000).toISOString(),
          expiresAt: new Date(Date.now() - 30000).toISOString(),
        },
        operation: {
          type: 'write',
        },
        concurrency: {
          waitingProcesses: [],
        },
      };

      const yaml = await import('js-yaml');
      await Bun.write(staleLockPath, yaml.dump(staleLock));

      await Bun.sleep(100);

      const file = Bun.file(staleLockPath);
      expect(await file.exists()).toBe(true);

      const lockId = await manager1.acquireLock('stale', 5000);
      expect(lockId).toBeDefined();
    });
  });

  describe('Waiting Queue', () => {
    it('should add process to waiting queue', async () => {
      await manager1.acquireLock('test', 1000);

      const waitPromise = manager2.acquireLock('test', 200).catch(() => {});
      await Bun.sleep(100);

      const info = await manager1.getLockInfo('test');
      const waitingPids = info?.concurrency.waitingProcesses.map((p) => p.pid) || [];

      expect(waitingPids).toContain(process.pid);

      await waitPromise;
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent lock attempts', async () => {
      const managers = Array.from({ length: 5 }, () => new ConcurrencyManager(testLockDir));

      const promises = managers.map(async (manager) => {
        try {
          return await manager.acquireLock('concurrent', 200);
        } catch {
          return null;
        }
      });

      const lockIds = await Promise.all(promises);
      const successfulLocks = lockIds.filter((id) => id !== null);

      expect(successfulLocks.length).toBe(1);

      for (const manager of managers) {
        await manager.releaseLock('concurrent');
      }
    });
  });
});
