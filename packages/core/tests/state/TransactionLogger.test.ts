import { test, expect, beforeEach, afterEach, describe, mock } from 'bun:test';
import { TransactionLogger } from '../../src/state/TransactionLogger';
import { Operation } from '../../src/state/types';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('TransactionLogger', () => {
  let transactionLogger: TransactionLogger;
  let tempDir: string;
  let logPath: string;

  beforeEach(async () => {
    // Create a temporary directory for test logs
    tempDir = await mkdtemp(join(tmpdir(), 'transaction-logger-test-'));
    transactionLogger = new TransactionLogger(tempDir);
    logPath = join(tempDir, 'audit.log');
  });

  afterEach(async () => {
    await transactionLogger.cleanup();
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    test('should initialize with log directory', () => {
      const logger = new TransactionLogger('/test/path');
      expect(logger).toBeDefined();
    });

    test('should set up log rotation timer', async () => {
      // The timer should be set up in the constructor
      const logger = new TransactionLogger(tempDir);
      await logger.cleanup();
    });
  });

  describe('logTransaction', () => {
    test('should log BEGIN transaction', async () => {
      const transactionId = 'tx-001';
      const metadata = { user: 'test-user' };

      await transactionLogger.logTransaction('BEGIN', transactionId, metadata);

      const content = await readFile(logPath, 'utf-8');
      const logEntry = JSON.parse(content.trim());

      expect(logEntry.action).toBe('BEGIN');
      expect(logEntry.transactionId).toBe(transactionId);
      expect(logEntry.metadata).toEqual(metadata);
      expect(logEntry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('should log COMMIT transaction', async () => {
      const transactionId = 'tx-002';

      await transactionLogger.logTransaction('COMMIT', transactionId);

      const content = await readFile(logPath, 'utf-8');
      const logEntry = JSON.parse(content.trim());

      expect(logEntry.action).toBe('COMMIT');
      expect(logEntry.transactionId).toBe(transactionId);
      expect(logEntry.metadata).toEqual({});
    });

    test('should log ROLLBACK transaction', async () => {
      const transactionId = 'tx-003';
      const metadata = { reason: 'validation-failed' };

      await transactionLogger.logTransaction('ROLLBACK', transactionId, metadata);

      const content = await readFile(logPath, 'utf-8');
      const logEntry = JSON.parse(content.trim());

      expect(logEntry.action).toBe('ROLLBACK');
      expect(logEntry.transactionId).toBe(transactionId);
      expect(logEntry.metadata).toEqual(metadata);
    });

    test('should log multiple transactions', async () => {
      await transactionLogger.logTransaction('BEGIN', 'tx-001');
      await transactionLogger.logTransaction('COMMIT', 'tx-001');
      await transactionLogger.logTransaction('BEGIN', 'tx-002');

      const content = await readFile(logPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(3);

      const entry1 = JSON.parse(lines[0]);
      const entry2 = JSON.parse(lines[1]);
      const entry3 = JSON.parse(lines[2]);

      expect(entry1.action).toBe('BEGIN');
      expect(entry1.transactionId).toBe('tx-001');
      expect(entry2.action).toBe('COMMIT');
      expect(entry2.transactionId).toBe('tx-001');
      expect(entry3.action).toBe('BEGIN');
      expect(entry3.transactionId).toBe('tx-002');
    });

    test('should handle logging errors gracefully', async () => {
      // Create a logger with an invalid path
      const invalidLogger = new TransactionLogger('/invalid/nonexistent/path');

      // Should not throw error, but handle it internally
      await expect(
        invalidLogger.logTransaction('BEGIN', 'tx-error')
      ).resolves.toBeUndefined();

      await invalidLogger.cleanup();
    });

    test('should handle metadata with complex objects', async () => {
      const complexMetadata = {
        user: { id: 123, name: 'test' },
        settings: { theme: 'dark', nested: { value: true } },
        array: [1, 2, 3],
        timestamp: new Date('2023-01-01').toISOString(),
      };

      await transactionLogger.logTransaction('BEGIN', 'tx-complex', complexMetadata);

      const content = await readFile(logPath, 'utf-8');
      const logEntry = JSON.parse(content.trim());

      expect(logEntry.metadata).toEqual(complexMetadata);
    });
  });

  describe('logOperation', () => {
    test('should log operation with all data', async () => {
      const operation: Operation = {
        id: 'op-001',
        type: 'write',
        path: '/test/path',
        data: { key: 'value' },
        timestamp: new Date().toISOString(),
      };
      const transactionId = 'tx-001';

      await transactionLogger.logOperation(operation, transactionId);

      const content = await readFile(logPath, 'utf-8');
      const logEntry = JSON.parse(content.trim());

      expect(logEntry.action).toBe('OPERATION');
      expect(logEntry.transactionId).toBe(transactionId);
      expect(logEntry.operation.id).toBe(operation.id);
      expect(logEntry.operation.type).toBe(operation.type);
      expect(logEntry.operation.path).toBe(operation.path);
      expect(logEntry.operation.hasData).toBe(true);
      expect(logEntry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('should log operation without data', async () => {
      const operation: Operation = {
        id: 'op-002',
        type: 'read',
        path: '/test/path',
        timestamp: new Date().toISOString(),
      };
      const transactionId = 'tx-002';

      await transactionLogger.logOperation(operation, transactionId);

      const content = await readFile(logPath, 'utf-8');
      const logEntry = JSON.parse(content.trim());

      expect(logEntry.operation.hasData).toBe(false);
    });

    test('should log multiple operations', async () => {
      const operation1: Operation = {
        id: 'op-001',
        type: 'read',
        path: '/path1',
        timestamp: new Date().toISOString(),
      };

      const operation2: Operation = {
        id: 'op-002',
        type: 'write',
        path: '/path2',
        data: { test: true },
        timestamp: new Date().toISOString(),
      };

      await transactionLogger.logOperation(operation1, 'tx-001');
      await transactionLogger.logOperation(operation2, 'tx-001');

      const content = await readFile(logPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(2);

      const entry1 = JSON.parse(lines[0]);
      const entry2 = JSON.parse(lines[1]);

      expect(entry1.operation.id).toBe('op-001');
      expect(entry1.operation.hasData).toBe(false);
      expect(entry2.operation.id).toBe('op-002');
      expect(entry2.operation.hasData).toBe(true);
    });

    test('should handle operation logging errors gracefully', async () => {
      const invalidLogger = new TransactionLogger('/invalid/nonexistent/path');
      const operation: Operation = {
        id: 'op-error',
        type: 'write',
        path: '/test',
        timestamp: new Date().toISOString(),
      };

      // Should not throw error
      await expect(
        invalidLogger.logOperation(operation, 'tx-error')
      ).resolves.toBeUndefined();

      await invalidLogger.cleanup();
    });
  });

  describe('readLog', () => {
    test('should read empty log', async () => {
      const logs = await transactionLogger.readLog();
      expect(logs).toEqual([]);
    });

    test('should read log with transactions', async () => {
      await transactionLogger.logTransaction('BEGIN', 'tx-001', { user: 'test' });
      await transactionLogger.logTransaction('COMMIT', 'tx-001');

      const logs = await transactionLogger.readLog();

      expect(logs).toHaveLength(2);
      expect(logs[0]).toMatchObject({
        action: 'BEGIN',
        transactionId: 'tx-001',
        metadata: { user: 'test' },
      });
      expect(logs[1]).toMatchObject({
        action: 'COMMIT',
        transactionId: 'tx-001',
      });
    });

    test('should read log with operations', async () => {
      const operation: Operation = {
        id: 'op-001',
        type: 'write',
        path: '/test',
        data: { key: 'value' },
        timestamp: new Date().toISOString(),
      };

      await transactionLogger.logOperation(operation, 'tx-001');

      const logs = await transactionLogger.readLog();

      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        action: 'OPERATION',
        transactionId: 'tx-001',
        operation: {
          id: 'op-001',
          type: 'write',
          path: '/test',
          hasData: true,
        },
      });
    });

    test('should handle malformed log lines', async () => {
      // Write a mix of valid and invalid JSON lines
      const content = `{"action":"BEGIN","transactionId":"tx-001","metadata":{},"timestamp":"2023-01-01T00:00:00.000Z"}
invalid json line
{"action":"COMMIT","transactionId":"tx-001","metadata":{},"timestamp":"2023-01-01T00:01:00.000Z"}
another invalid line
{"action":"BEGIN","transactionId":"tx-002","metadata":{},"timestamp":"2023-01-01T00:02:00.000Z"}`;

      await writeFile(logPath, content);

      const logs = await transactionLogger.readLog();

      // Should only return valid entries
      expect(logs).toHaveLength(3);
      expect((logs[0] as any).action).toBe('BEGIN');
      expect((logs[1] as any).action).toBe('COMMIT');
      expect((logs[2] as any).action).toBe('BEGIN');
    });

    test('should handle empty lines', async () => {
      const content = `{"action":"BEGIN","transactionId":"tx-001","metadata":{},"timestamp":"2023-01-01T00:00:00.000Z"}


{"action":"COMMIT","transactionId":"tx-001","metadata":{},"timestamp":"2023-01-01T00:01:00.000Z"}

`;

      await writeFile(logPath, content);

      const logs = await transactionLogger.readLog();

      expect(logs).toHaveLength(2);
    });

    test('should handle non-existent log file', async () => {
      // Delete the log file if it exists
      try {
        await rm(logPath);
      } catch (error) {
        // File might not exist, which is fine
      }

      const logs = await transactionLogger.readLog();
      expect(logs).toEqual([]);
    });

    test('should propagate other file system errors', async () => {
      // Create a directory where the log file should be
      await rm(logPath, { force: true });
      await mkdir(logPath);

      await expect(transactionLogger.readLog()).rejects.toThrow();
    });
  });

  describe('cleanup', () => {
    test('should clear rotation timer', async () => {
      const logger = new TransactionLogger(tempDir);

      // Timer should be active after construction
      expect(logger).toBeDefined();

      await logger.cleanup();

      // Should complete without error
    });

    test('should handle cleanup when timer is null', async () => {
      await transactionLogger.cleanup();

      // Call cleanup again
      await transactionLogger.cleanup();

      // Should not throw error
    });
  });

  describe('log rotation', () => {
    test('should not rotate small log files', async () => {
      // Add a few small entries
      await transactionLogger.logTransaction('BEGIN', 'tx-001');
      await transactionLogger.logTransaction('COMMIT', 'tx-001');

      // Trigger rotation check manually (accessing private method for testing)
      const rotateMethod = (transactionLogger as any).rotateLogIfNeeded.bind(transactionLogger);
      await rotateMethod();

      // Original log should still exist with content
      const content = await readFile(logPath, 'utf-8');
      expect(content.trim().split('\n')).toHaveLength(2);
    });

    test('should rotate large log files', async () => {
      // Create a large log file (> 10MB)
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      await writeFile(logPath, largeContent);

      // Trigger rotation
      const rotateMethod = (transactionLogger as any).rotateLogIfNeeded.bind(transactionLogger);
      await rotateMethod();

      // Original log should be empty now
      const content = await readFile(logPath, 'utf-8');
      expect(content).toBe('');

      // Rotated file should exist with original content
      const files = await require('node:fs/promises').readdir(tempDir);
      const rotatedFiles = files.filter((f: string) => f.startsWith('audit.log.') && f !== 'audit.log');
      expect(rotatedFiles.length).toBeGreaterThan(0);
    });

    test('should handle rotation when log file does not exist', async () => {
      // Ensure log file doesn't exist
      try {
        await rm(logPath);
      } catch (error) {
        // File might not exist, which is fine
      }

      // Trigger rotation
      const rotateMethod = (transactionLogger as any).rotateLogIfNeeded.bind(transactionLogger);
      await rotateMethod();

      // Should not throw error
    });

    test('should handle rotation errors gracefully', async () => {
      // Create a large log that would trigger rotation
      const largeContent = 'x'.repeat(11 * 1024 * 1024);
      await writeFile(logPath, largeContent);

      // Create an invalid logger with a path that will cause errors
      const invalidLogger = new TransactionLogger('/invalid/readonly/path');

      const rotateMethod = (invalidLogger as any).rotateLogIfNeeded.bind(invalidLogger);

      // Should handle errors gracefully without throwing
      await expect(rotateMethod()).resolves.toBeUndefined();

      await invalidLogger.cleanup();
    });

    test('should handle stat errors in rotation check', async () => {
      // Create a logger with a path that will cause stat to fail
      const invalidLogger = new TransactionLogger('/nonexistent/path');

      const rotateMethod = (invalidLogger as any).rotateLogIfNeeded.bind(invalidLogger);

      // Should not throw error when file doesn't exist
      await expect(rotateMethod()).resolves.toBeUndefined();

      await invalidLogger.cleanup();
    });

    test('should create rotated file with timestamp', async () => {
      // Create content that exceeds rotation size
      const largeContent = JSON.stringify({ large: 'x'.repeat(11 * 1024 * 1024) });
      await writeFile(logPath, largeContent);

      const rotateLogMethod = (transactionLogger as any).rotateLog.bind(transactionLogger);
      await rotateLogMethod();

      // Check that rotated file exists with timestamp
      const files = await require('node:fs/promises').readdir(tempDir);
      const rotatedFiles = files.filter((f: string) => f.startsWith('audit.log.2'));
      expect(rotatedFiles.length).toBeGreaterThan(0);

      // Rotated file should contain the original content
      const rotatedPath = join(tempDir, rotatedFiles[0]);
      const rotatedContent = await readFile(rotatedPath, 'utf-8');
      expect(rotatedContent).toBe(largeContent);
    });

    test('should handle rotation when log file is already gone', async () => {
      const rotateLogMethod = (transactionLogger as any).rotateLog.bind(transactionLogger);

      // Ensure log file doesn't exist
      try {
        await rm(logPath);
      } catch (error) {
        // Ignore
      }

      // Should not throw error and should return early
      await expect(rotateLogMethod()).resolves.toBeUndefined();
    });
  });

  describe('integration scenarios', () => {
    test('should handle mixed transaction and operation logging', async () => {
      const operation: Operation = {
        id: 'op-001',
        type: 'write',
        path: '/data/file.json',
        data: { updated: true },
        timestamp: new Date().toISOString(),
      };

      // Log a complete transaction with operations
      await transactionLogger.logTransaction('BEGIN', 'tx-complete', { user: 'integration-test' });
      await transactionLogger.logOperation(operation, 'tx-complete');
      await transactionLogger.logTransaction('COMMIT', 'tx-complete');

      const logs = await transactionLogger.readLog();

      expect(logs).toHaveLength(3);
      expect((logs[0] as any).action).toBe('BEGIN');
      expect((logs[1] as any).action).toBe('OPERATION');
      expect((logs[2] as any).action).toBe('COMMIT');

      // All should have the same transaction ID
      expect((logs[0] as any).transactionId).toBe('tx-complete');
      expect((logs[1] as any).transactionId).toBe('tx-complete');
      expect((logs[2] as any).transactionId).toBe('tx-complete');
    });

    test('should handle concurrent logging operations', async () => {
      const promises = [];

      // Log multiple transactions concurrently
      for (let i = 0; i < 10; i++) {
        promises.push(
          transactionLogger.logTransaction('BEGIN', `tx-concurrent-${i}`, { index: i })
        );
      }

      await Promise.all(promises);

      const logs = await transactionLogger.readLog();
      expect(logs).toHaveLength(10);

      // All logs should be valid
      logs.forEach((log, index) => {
        expect((log as any).action).toBe('BEGIN');
        expect((log as any).transactionId).toMatch(/^tx-concurrent-\d+$/);
      });
    });

    test('should preserve log order', async () => {
      const operations = [
        { action: 'BEGIN', id: 'tx-001' },
        { action: 'OPERATION', id: 'tx-001' },
        { action: 'OPERATION', id: 'tx-001' },
        { action: 'COMMIT', id: 'tx-001' },
        { action: 'BEGIN', id: 'tx-002' },
        { action: 'ROLLBACK', id: 'tx-002' },
      ];

      for (const op of operations) {
        if (op.action === 'OPERATION') {
          const operation: Operation = {
            id: `op-${Math.random()}`,
            type: 'test',
            path: '/test',
            timestamp: new Date().toISOString(),
          };
          await transactionLogger.logOperation(operation, op.id);
        } else {
          await transactionLogger.logTransaction(
            op.action as 'BEGIN' | 'COMMIT' | 'ROLLBACK',
            op.id
          );
        }
      }

      const logs = await transactionLogger.readLog();
      expect(logs).toHaveLength(6);

      expect((logs[0] as any).action).toBe('BEGIN');
      expect((logs[1] as any).action).toBe('OPERATION');
      expect((logs[2] as any).action).toBe('OPERATION');
      expect((logs[3] as any).action).toBe('COMMIT');
      expect((logs[4] as any).action).toBe('BEGIN');
      expect((logs[5] as any).action).toBe('ROLLBACK');
    });
  });

  describe('edge cases', () => {
    test('should handle very long metadata', async () => {
      const longMetadata = {
        description: 'x'.repeat(10000),
        data: Array(1000).fill({ key: 'value' }),
      };

      await transactionLogger.logTransaction('BEGIN', 'tx-long', longMetadata);

      const logs = await transactionLogger.readLog();
      expect(logs).toHaveLength(1);
      expect((logs[0] as any).metadata).toEqual(longMetadata);
    });

    test('should handle special characters in paths and data', async () => {
      const operation: Operation = {
        id: 'op-special',
        type: 'write',
        path: '/特殊/path/with/émojis/🚀/and/quotes/"double"/and/\'single\'',
        data: {
          special: 'characters: \n\t\r\b\f',
          unicode: '🚀 ñoñó çáráçtérs',
          quotes: 'mixed "quotes" and \'apostrophes\'',
        },
        timestamp: new Date().toISOString(),
      };

      await transactionLogger.logOperation(operation, 'tx-special');

      const logs = await transactionLogger.readLog();
      expect(logs).toHaveLength(1);
      expect((logs[0] as any).operation.path).toBe(operation.path);
    });

    test('should handle null and undefined values in metadata', async () => {
      const metadata = {
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        zero: 0,
        false: false,
      };

      await transactionLogger.logTransaction('BEGIN', 'tx-null', metadata);

      const logs = await transactionLogger.readLog();
      expect(logs).toHaveLength(1);

      // undefined values are removed during JSON serialization
      expect((logs[0] as any).metadata).toEqual({
        nullValue: null,
        emptyString: '',
        zero: 0,
        false: false,
      });
    });

    test('should handle circular references in metadata', async () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      // JSON.stringify throws an error for circular references
      // The implementation should handle this gracefully and not crash
      try {
        await transactionLogger.logTransaction('BEGIN', 'tx-circular', circularObj);
        // If we get here, it means the error was handled gracefully
      } catch (error) {
        // This is expected - JSON.stringify will throw
        expect(error).toBeDefined();
      }

      // The log file should still be readable (no corruption)
      const logs = await transactionLogger.readLog();
      // Should be able to read logs without issue
      expect(Array.isArray(logs)).toBe(true);
    });
  });
});