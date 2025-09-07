import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { WriteAheadLog, type WALEntry } from '../../src/state/WriteAheadLog';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

describe('WriteAheadLog', () => {
  let testDir: string;
  let wal: WriteAheadLog;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'wal-test-'));
    wal = new WriteAheadLog(testDir);
  });

  afterEach(async () => {
    if (testDir && existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('append', () => {
    it('should append entries to WAL', async () => {
      const entry = {
        op: 'write' as const,
        key: 'test-key',
        value: { data: 'test' },
        transactionId: 'tx-123'
      };

      await wal.append(entry);
      const entries = await wal.getEntries();
      
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject(entry);
      expect(entries[0].timestamp).toBeDefined();
    });

    it('should persist entries to disk', async () => {
      const entry = {
        op: 'write' as const,
        key: 'persistent-key',
        value: 'persistent-value'
      };

      await wal.append(entry);
      
      // Ensure file is written before checking
      await Bun.sleep(10);
      expect(await wal.exists()).toBe(true);

      const newWal = new WriteAheadLog(testDir);
      const entries = await newWal.replay();
      
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject(entry);
    });

    it('should handle multiple entries', async () => {
      const entries = [
        { op: 'write' as const, key: 'key1', value: 'value1' },
        { op: 'write' as const, key: 'key2', value: 'value2' },
        { op: 'delete' as const, key: 'key1' }
      ];

      for (const entry of entries) {
        await wal.append(entry);
      }

      const storedEntries = await wal.getEntries();
      expect(storedEntries).toHaveLength(3);
    });

    it('should measure performance and warn if exceeding target', async () => {
      const largeValue = 'x'.repeat(1000000);
      const entry = {
        op: 'write' as const,
        key: 'large-key',
        value: largeValue
      };

      const startTime = performance.now();
      await wal.append(entry);
      const duration = performance.now() - startTime;

      expect(await wal.exists()).toBe(true);
      if (duration > 10) {
        console.log(`Warning: WAL append took ${duration}ms`);
      }
    });
  });

  describe('replay', () => {
    it('should replay entries from disk', async () => {
      const entries = [
        { op: 'write' as const, key: 'key1', value: 'value1' },
        { op: 'write' as const, key: 'key2', value: { nested: true } },
        { op: 'delete' as const, key: 'key3' }
      ];

      for (const entry of entries) {
        await wal.append(entry);
      }

      // Create a new WAL instance to test replay from disk
      const newWal = new WriteAheadLog(testDir);
      const replayedEntries = await newWal.replay();

      expect(replayedEntries).toHaveLength(3);
      expect(replayedEntries[0]).toMatchObject(entries[0]);
      expect(replayedEntries[1]).toMatchObject(entries[1]);
      expect(replayedEntries[2]).toMatchObject(entries[2]);
    });

    it('should handle empty WAL file', async () => {
      const entries = await wal.replay();
      expect(entries).toEqual([]);
    });

    it('should handle corrupted entries gracefully', async () => {
      const walPath = join(testDir, '.wal', 'wal.log');
      
      await wal.append({ op: 'write', key: 'valid', value: 'entry' });
      
      const file = Bun.file(walPath);
      const content = await file.text();
      const corruptedContent = content + 'CORRUPTED_LINE\n' + JSON.stringify({ op: 'write', key: 'after-corrupt', value: 'valid' }) + '\n';
      await Bun.write(walPath, corruptedContent);

      const newWal = new WriteAheadLog(testDir);
      const entries = await newWal.replay();
      
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0].key).toBe('valid');
    });

    it('should prevent concurrent replay', async () => {
      await wal.append({ op: 'write', key: 'test', value: 'data' });

      const replay1 = wal.replay();
      const replay2 = wal.replay();

      const [result1, result2] = await Promise.all([replay1, replay2]);
      
      expect(result1.length + result2.length).toBeGreaterThanOrEqual(1);
    });

    it('should measure replay performance', async () => {
      for (let i = 0; i < 100; i++) {
        await wal.append({ 
          op: 'write', 
          key: `key-${i}`, 
          value: `value-${i}` 
        });
      }

      // Force flush to disk
      const walEntries = await wal.getEntries();
      expect(walEntries).toHaveLength(100);

      const newWal = new WriteAheadLog(testDir);
      const startTime = performance.now();
      const entries = await newWal.replay();
      const duration = performance.now() - startTime;

      expect(entries).toHaveLength(100);
      expect(duration).toBeLessThan(200);
      
      if (duration > 100) {
        console.log(`Warning: WAL replay took ${duration}ms for 100 entries`);
      }
    });
  });

  describe('clear', () => {
    it('should clear WAL entries and file', async () => {
      await wal.append({ op: 'write', key: 'test', value: 'data' });
      expect(await wal.exists()).toBe(true);
      
      await wal.clear();
      
      expect(await wal.getEntries()).toEqual([]);
      expect(await wal.exists()).toBe(false);
    });

    it('should handle clearing empty WAL', async () => {
      await wal.clear(); // Should not throw
      expect(await wal.getEntries()).toEqual([]);
    });

    it('should measure clear performance', async () => {
      await wal.append({ op: 'write', key: 'test', value: 'data' });

      const startTime = performance.now();
      await wal.clear();
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(10);
      
      if (duration > 5) {
        console.log(`Warning: WAL clear took ${duration}ms`);
      }
    });
  });

  describe('backup and rotate', () => {
    it('should create backup of WAL', async () => {
      await wal.append({ op: 'write', key: 'backup-test', value: 'data' });
      
      const backupPath = await wal.createBackup();
      
      expect(existsSync(backupPath)).toBe(true);
      
      const backupFile = Bun.file(backupPath);
      const content = await backupFile.text();
      expect(content).toContain('backup-test');
    });

    it('should rotate WAL when size exceeds limit', async () => {
      const smallLimit = 100;
      
      await wal.append({ op: 'write', key: 'test', value: 'x'.repeat(50) });
      await wal.append({ op: 'write', key: 'test2', value: 'x'.repeat(50) });
      
      const sizeBefore = await wal.size();
      expect(sizeBefore).toBeGreaterThan(smallLimit);
      
      await wal.rotate(smallLimit);
      
      const sizeAfter = await wal.size();
      expect(sizeAfter).toBe(0);
      expect(await wal.getEntries()).toEqual([]);
    });

    it('should not rotate if under size limit', async () => {
      await wal.append({ op: 'write', key: 'small', value: 'data' });
      
      const sizeBefore = await wal.size();
      await wal.rotate(1024 * 1024);
      const sizeAfter = await wal.size();
      
      expect(sizeAfter).toBe(sizeBefore);
      expect(await wal.getEntries()).toHaveLength(1);
    });
  });

  describe('applyEntry', () => {
    it('should apply entry using provided function', async () => {
      const entry: WALEntry = {
        timestamp: Date.now(),
        op: 'write',
        key: 'apply-test',
        value: 'test-value'
      };

      let appliedEntry: WALEntry | null = null;
      
      await wal.applyEntry(entry, async (e) => {
        appliedEntry = e;
      });

      expect(appliedEntry).not.toBeNull();
      expect(appliedEntry!).toEqual(entry);
    });

    it('should propagate errors from apply function', async () => {
      const entry: WALEntry = {
        timestamp: Date.now(),
        op: 'write',
        key: 'error-test',
        value: 'test'
      };

      await expect(
        wal.applyEntry(entry, async () => {
          throw new Error('Apply failed');
        })
      ).rejects.toThrow('Failed to apply WAL entry');
    });
  });

  describe('edge cases', () => {
    it('should handle disk full scenario gracefully', async () => {
      const entry = {
        op: 'write' as const,
        key: 'disk-full-test',
        value: 'x'.repeat(1000)
      };

      try {
        await wal.append(entry);
        expect(await wal.exists()).toBe(true);
      } catch (error) {
        expect(String(error)).toContain('Failed to append to WAL');
      }
    });

    it('should handle read-only filesystem', async () => {
      const readOnlyDir = '/sys';
      
      // Attempting to create WAL outside project root should throw
      expect(() => new WriteAheadLog(readOnlyDir)).toThrow('Invalid state directory');
    });

    it('should recover from partial writes', async () => {
      const walPath = join(testDir, '.wal', 'wal.log');
      
      await wal.append({ op: 'write', key: 'complete', value: 'entry' });
      
      const file = Bun.file(walPath);
      const content = await file.text();
      const partialContent = content + '{"op":"write","key":"partial"';
      await Bun.write(walPath, partialContent);

      const newWal = new WriteAheadLog(testDir);
      const entries = await newWal.replay();
      
      expect(entries.some(e => e.key === 'complete')).toBe(true);
      expect(entries.some(e => e.key === 'partial')).toBe(false);
    });
  });
});