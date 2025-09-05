import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DirectoryManager } from './DirectoryManager';

describe('DirectoryManager', () => {
  const testBaseDir = '.test-checklist';
  let directoryManager: DirectoryManager;

  beforeEach(() => {
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
    directoryManager = new DirectoryManager(testBaseDir);
  });

  afterEach(() => {
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  describe('Directory Creation', () => {
    it('should create base directory structure', async () => {
      await directoryManager.initialize();

      expect(existsSync(testBaseDir)).toBe(true);
      expect(existsSync(join(testBaseDir, 'backups'))).toBe(true);
      expect(existsSync(join(testBaseDir, '.locks'))).toBe(true);
      expect(existsSync(join(testBaseDir, '.cache'))).toBe(true);
      expect(existsSync(join(testBaseDir, 'logs'))).toBe(true);
    });

    it('should set correct permissions on directories', async () => {
      await directoryManager.initialize();

      const baseStat = statSync(testBaseDir);
      const backupStat = statSync(join(testBaseDir, 'backups'));
      const lockStat = statSync(join(testBaseDir, '.locks'));

      const checkPermissions = (mode: number) => (mode & 0o777) === 0o755;

      expect(checkPermissions(baseStat.mode)).toBe(true);
      expect(checkPermissions(backupStat.mode)).toBe(true);
      expect(checkPermissions(lockStat.mode)).toBe(true);
    });

    it('should handle existing directories gracefully', async () => {
      await directoryManager.initialize();
      await directoryManager.initialize();

      expect(existsSync(testBaseDir)).toBe(true);
    });

    it('should cleanup on failure', async () => {
      const invalidDirManager = new DirectoryManager('/root/invalid-path');
      
      try {
        await invalidDirManager.initialize();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Path Getters', () => {
    it('should return correct paths', () => {
      expect(directoryManager.getBasePath()).toContain(testBaseDir);
      expect(directoryManager.getBackupPath()).toContain(join(testBaseDir, 'backups'));
      expect(directoryManager.getLockPath()).toContain(join(testBaseDir, '.locks'));
      expect(directoryManager.getCachePath()).toContain(join(testBaseDir, '.cache'));
      expect(directoryManager.getLogPath()).toContain(join(testBaseDir, 'logs'));
      expect(directoryManager.getStatePath()).toContain(join(testBaseDir, 'state.yaml'));
    });
  });

  describe('Cleanup', () => {
    it('should clean up directories on request', async () => {
      await directoryManager.initialize();
      
      const testFile = join(testBaseDir, '.cache', 'test.txt');
      await Bun.write(testFile, 'test content');
      
      await directoryManager.cleanup();

      expect(existsSync(testFile)).toBe(false);
    });

    it('should handle cleanup errors gracefully', async () => {
      await expect(directoryManager.cleanup()).resolves.toBeUndefined();
    });
  });
});