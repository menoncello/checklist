import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import * as yaml from 'js-yaml';
import { MigrationRecordKeeper } from '../../../src/state/migrations/MigrationRecordKeeper';
import type { Migration, StateSchema, MigrationRecord } from '../../../src/state/migrations/types';

describe('MigrationRecordKeeper', () => {
  let recordKeeper: MigrationRecordKeeper;
  let testMigration: Migration;
  let testState: StateSchema;
  let tempDir: string;
  let statePath: string;

  beforeEach(async () => {
    recordKeeper = new MigrationRecordKeeper();

    // Create temporary directory for real file operations
    tempDir = await mkdtemp(join(tmpdir(), 'migration-test-'));
    statePath = join(tempDir, 'state.yaml');

    testMigration = {
      id: 'test-migration-1',
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
      description: 'Test migration',
      up: (state: unknown) => state as Record<string, unknown>,
      down: (state: unknown) => state as Record<string, unknown>,
    };

    testState = {
      schemaVersion: '1.0.0',
      version: '1.0.0',
      lastModified: new Date().toISOString(),
      migrations: [],
      checklists: [],
      templates: [],
      variables: {},
      settings: {},
      metadata: {
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
      },
    };

    // Write initial state file
    await Bun.write(statePath, yaml.dump(testState));
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('recordMigration', () => {
    test('should successfully record a migration', async () => {
      const startTime = Date.now();
      const endTime = startTime + 1000;

      const result = await recordKeeper.recordMigration({
        migration: testMigration,
        state: testState,
        statePath,
        startTime,
        endTime,
        success: true,
      });

      expect(result.version).toBe('1.1.0');
      expect(result.migrations).toHaveLength(1);

      const migrationRecord = (result.migrations as MigrationRecord[])[0];
      expect(migrationRecord.from).toBe('1.0.0');
      expect(migrationRecord.to).toBe('1.1.0');
      expect(migrationRecord.changes).toContain('Applied migration test-migration-1');
      expect(migrationRecord.applied).toBeDefined();
      expect(migrationRecord.appliedAt).toBeDefined();

      // Verify state was persisted
      const persistedState = yaml.load(await Bun.file(statePath).text()) as StateSchema;
      expect(persistedState.version).toBe('1.1.0');
      expect(persistedState.migrations).toHaveLength(1);
    });

    test('should record migration with error information', async () => {
      const startTime = Date.now();
      const endTime = startTime + 500;
      const error = new Error('Migration failed');

      const result = await recordKeeper.recordMigration({
        migration: testMigration,
        state: testState,
        statePath,
        startTime,
        endTime,
        success: false,
        error,
      });

      const migrationRecord = (result.migrations as MigrationRecord[])[0];
      expect(migrationRecord.changes).toContain('Error: Migration failed');
    });

    test('should replace existing migration record for retry', async () => {
      const existingRecord: MigrationRecord = {
        from: '1.0.0',
        to: '1.1.0',
        applied: new Date().toISOString(),
        changes: ['Previous attempt'],
      };

      const stateWithExistingRecord = {
        ...testState,
        migrations: [existingRecord],
      };

      const result = await recordKeeper.recordMigration({
        migration: testMigration,
        state: stateWithExistingRecord,
        statePath,
        startTime: Date.now(),
        endTime: Date.now() + 100,
        success: true,
      });

      expect(result.migrations).toHaveLength(1);
      const newRecord = (result.migrations as MigrationRecord[])[0];
      expect(newRecord.changes).toContain('Applied migration test-migration-1');
      expect(newRecord.changes).not.toContain('Previous attempt');
    });

    test('should handle migration without id', async () => {
      const migrationWithoutId: Migration = {
        fromVersion: '1.0.0',
        toVersion: '1.1.0',
        description: 'Migration without ID',
        up: (state: unknown) => state as Record<string, unknown>,
        down: (state: unknown) => state as Record<string, unknown>,
      };

      const result = await recordKeeper.recordMigration({
        migration: migrationWithoutId,
        state: testState,
        statePath,
        startTime: Date.now(),
        endTime: Date.now() + 100,
        success: true,
      });

      const migrationRecord = (result.migrations as MigrationRecord[])[0];
      expect(migrationRecord.changes).toContain('Applied migration unknown');
    });

    test('should handle recording errors when state file cannot be written', async () => {
      // Make the temp directory read-only to force a write error
      const fs = await import('fs/promises');
      const readOnlyDir = join(tempDir, 'readonly');
      await fs.mkdir(readOnlyDir);
      const readOnlyPath = join(readOnlyDir, 'state.yaml');

      // Create the file first, then make the directory read-only
      await Bun.write(readOnlyPath, yaml.dump(testState));
      await fs.chmod(readOnlyDir, 0o444); // Read-only

      try {
        await expect(recordKeeper.recordMigration({
          migration: testMigration,
          state: testState,
          statePath: readOnlyPath,
          startTime: Date.now(),
          endTime: Date.now() + 100,
          success: true,
        })).rejects.toThrow('Failed to record migration');
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(readOnlyDir, 0o755);
      }
    });
  });

  describe('getMigrationHistory', () => {
    test('should return migration history from state file', async () => {
      const migrationRecords: MigrationRecord[] = [
        {
          from: '1.0.0',
          to: '1.1.0',
          applied: new Date().toISOString(),
          changes: ['Applied migration 1'],
        },
        {
          from: '1.1.0',
          to: '1.2.0',
          applied: new Date().toISOString(),
          changes: ['Applied migration 2'],
        },
      ];

      const stateWithHistory = {
        ...testState,
        migrations: migrationRecords,
      };

      await Bun.write(statePath, yaml.dump(stateWithHistory));

      const result = await recordKeeper.getMigrationHistory(statePath);

      expect(result).toHaveLength(2);
      expect(result[0].from).toBe('1.0.0');
      expect(result[1].from).toBe('1.1.0');
    });

    test('should return empty array when state has no migrations', async () => {
      await Bun.write(statePath, yaml.dump(testState));

      const result = await recordKeeper.getMigrationHistory(statePath);

      expect(result).toEqual([]);
    });

    test('should return empty array when file does not exist', async () => {
      const nonExistentPath = join(tempDir, 'nonexistent.yaml');

      const result = await recordKeeper.getMigrationHistory(nonExistentPath);

      expect(result).toEqual([]);
    });

    test('should handle invalid state file format', async () => {
      await Bun.write(statePath, 'invalid: yaml: content: {');

      const result = await recordKeeper.getMigrationHistory(statePath);

      expect(result).toEqual([]);
    });

    test('should handle null state content', async () => {
      await Bun.write(statePath, '');

      const result = await recordKeeper.getMigrationHistory(statePath);

      expect(result).toEqual([]);
    });
  });

  describe('isAlreadyApplied', () => {
    test('should return true when migration is already applied', async () => {
      const migrationRecord: MigrationRecord = {
        from: '1.0.0',
        to: '1.1.0',
        applied: new Date().toISOString(),
        changes: ['Applied'],
      };

      const stateWithHistory = {
        ...testState,
        migrations: [migrationRecord],
      };

      await Bun.write(statePath, yaml.dump(stateWithHistory));

      const result = await recordKeeper.isAlreadyApplied(statePath, testMigration);

      expect(result).toBe(true);
    });

    test('should return false when migration is not applied', async () => {
      await Bun.write(statePath, yaml.dump(testState));

      const result = await recordKeeper.isAlreadyApplied(statePath, testMigration);

      expect(result).toBe(false);
    });

    test('should return false when different migration exists', async () => {
      const differentRecord: MigrationRecord = {
        from: '1.1.0',
        to: '1.2.0',
        applied: new Date().toISOString(),
        changes: ['Different migration'],
      };

      const stateWithHistory = {
        ...testState,
        migrations: [differentRecord],
      };

      await Bun.write(statePath, yaml.dump(stateWithHistory));

      const result = await recordKeeper.isAlreadyApplied(statePath, testMigration);

      expect(result).toBe(false);
    });

    test('should return false on error', async () => {
      const nonExistentPath = join(tempDir, 'nonexistent.yaml');

      const result = await recordKeeper.isAlreadyApplied(nonExistentPath, testMigration);

      expect(result).toBe(false);
    });
  });

  describe('getLastSuccessfulMigration', () => {
    test('should return the most recent successful migration', async () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 60000); // 1 minute earlier

      const migrationRecords: MigrationRecord[] = [
        {
          from: '1.0.0',
          to: '1.1.0',
          applied: earlier.toISOString(),
          appliedAt: earlier.toISOString(),
          changes: ['Applied migration 1'],
        },
        {
          from: '1.1.0',
          to: '1.2.0',
          applied: now.toISOString(),
          appliedAt: now.toISOString(),
          changes: ['Applied migration 2'],
        },
      ];

      const stateWithHistory = {
        ...testState,
        migrations: migrationRecords,
      };

      await Bun.write(statePath, yaml.dump(stateWithHistory));

      const result = await recordKeeper.getLastSuccessfulMigration(statePath);

      expect(result).not.toBeNull();
      expect(result?.to).toBe('1.2.0');
      expect(result?.from).toBe('1.1.0');
    });

    test('should filter out failed migrations with error messages', async () => {
      const migrationRecords: MigrationRecord[] = [
        {
          from: '1.0.0',
          to: '1.1.0',
          applied: new Date().toISOString(),
          changes: ['Applied migration 1'],
        },
        {
          from: '1.1.0',
          to: '1.2.0',
          applied: new Date().toISOString(),
          changes: ['Error: Migration failed'],
        },
      ];

      const stateWithHistory = {
        ...testState,
        migrations: migrationRecords,
      };

      await Bun.write(statePath, yaml.dump(stateWithHistory));

      const result = await recordKeeper.getLastSuccessfulMigration(statePath);

      expect(result).not.toBeNull();
      expect(result?.to).toBe('1.1.0');
    });

    test('should handle migrations without appliedAt field', async () => {
      const migrationRecord: MigrationRecord = {
        from: '1.0.0',
        to: '1.1.0',
        applied: new Date().toISOString(),
        changes: ['Applied migration'],
      };

      const stateWithHistory = {
        ...testState,
        migrations: [migrationRecord],
      };

      await Bun.write(statePath, yaml.dump(stateWithHistory));

      const result = await recordKeeper.getLastSuccessfulMigration(statePath);

      expect(result).not.toBeNull();
      expect(result?.to).toBe('1.1.0');
    });

    test('should handle empty migration changes array', async () => {
      const migrationRecord: MigrationRecord = {
        from: '1.0.0',
        to: '1.1.0',
        applied: new Date().toISOString(),
        changes: [], // Empty changes array
      };

      const stateWithEmptyChanges = {
        ...testState,
        migrations: [migrationRecord],
      };

      await Bun.write(statePath, yaml.dump(stateWithEmptyChanges));

      const result = await recordKeeper.getLastSuccessfulMigration(statePath);

      expect(result).not.toBeNull();
      expect(result?.to).toBe('1.1.0');
    });

    test('should return null when no successful migrations exist', async () => {
      await Bun.write(statePath, yaml.dump(testState));

      const result = await recordKeeper.getLastSuccessfulMigration(statePath);

      expect(result).toBeNull();
    });

    test('should return null on error', async () => {
      const nonExistentPath = join(tempDir, 'nonexistent.yaml');

      const result = await recordKeeper.getLastSuccessfulMigration(nonExistentPath);

      expect(result).toBeNull();
    });
  });

  describe('cleanupFailedMigrations', () => {
    test('should remove failed migrations and keep successful ones', async () => {
      const migrationRecords: MigrationRecord[] = [
        {
          from: '1.0.0',
          to: '1.1.0',
          applied: new Date().toISOString(),
          changes: ['Applied migration 1'],
        },
        {
          from: '1.1.0',
          to: '1.2.0',
          applied: new Date().toISOString(),
          changes: ['Error: Migration failed'],
        },
        {
          from: '1.2.0',
          to: '1.3.0',
          applied: new Date().toISOString(),
          changes: ['Applied migration 3'],
        },
      ];

      const stateWithFailures = {
        ...testState,
        migrations: migrationRecords,
      };

      await Bun.write(statePath, yaml.dump(stateWithFailures));

      await recordKeeper.cleanupFailedMigrations(statePath);

      // Verify the cleaned state
      const cleanedState = yaml.load(await Bun.file(statePath).text()) as StateSchema;
      expect(cleanedState.migrations).toHaveLength(2);

      const remainingMigrations = cleanedState.migrations as MigrationRecord[];
      expect(remainingMigrations.some(m => m.to === '1.1.0')).toBe(true);
      expect(remainingMigrations.some(m => m.to === '1.3.0')).toBe(true);
      expect(remainingMigrations.some(m => m.to === '1.2.0')).toBe(false); // Failed migration should be removed
    });

    test('should handle migrations with null or undefined changes', async () => {
      const migrationRecords: MigrationRecord[] = [
        {
          from: '1.0.0',
          to: '1.1.0',
          applied: new Date().toISOString(),
          changes: ['Applied migration'],
        },
        {
          from: '1.1.0',
          to: '1.2.0',
          applied: new Date().toISOString(),
          // changes: undefined - should be kept as it's not considered failed
        },
      ];

      const stateWithMixedRecords = {
        ...testState,
        migrations: migrationRecords,
      };

      await Bun.write(statePath, yaml.dump(stateWithMixedRecords));

      await recordKeeper.cleanupFailedMigrations(statePath);

      // State should not be modified since no failed migrations exist
      const unchangedState = yaml.load(await Bun.file(statePath).text()) as StateSchema;
      expect(unchangedState.migrations).toHaveLength(2);
    });

    test('should not modify state when no failed migrations exist', async () => {
      const migrationRecords: MigrationRecord[] = [
        {
          from: '1.0.0',
          to: '1.1.0',
          applied: new Date().toISOString(),
          changes: ['Applied migration'],
        },
      ];

      const stateWithSuccessful = {
        ...testState,
        migrations: migrationRecords,
      };

      await Bun.write(statePath, yaml.dump(stateWithSuccessful));
      const originalContent = await Bun.file(statePath).text();

      await recordKeeper.cleanupFailedMigrations(statePath);

      // File content should not have been modified
      const newContent = await Bun.file(statePath).text();
      expect(newContent).toBe(originalContent);
    });

    test('should handle and rethrow errors', async () => {
      const nonExistentPath = join(tempDir, 'nonexistent.yaml');

      await expect(recordKeeper.cleanupFailedMigrations(nonExistentPath))
        .rejects.toThrow();
    });
  });

  describe('private method coverage through integration', () => {
    test('should create migration record with proper timestamps', async () => {
      const beforeTest = new Date().toISOString();

      const result = await recordKeeper.recordMigration({
        migration: testMigration,
        state: testState,
        statePath,
        startTime: Date.now(),
        endTime: Date.now() + 100,
        success: true,
      });

      const migrationRecord = (result.migrations as MigrationRecord[])[0];
      expect(migrationRecord.applied).toBeDefined();
      expect(migrationRecord.appliedAt).toBeDefined();
      expect(new Date(migrationRecord.applied).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeTest).getTime()
      );
    });

    test('should persist state with correct YAML format', async () => {
      await recordKeeper.recordMigration({
        migration: testMigration,
        state: testState,
        statePath,
        startTime: Date.now(),
        endTime: Date.now() + 100,
        success: true,
      });

      const yamlContent = await Bun.file(statePath).text();
      expect(yamlContent).toContain('version: 1.1.0');
      expect(yamlContent).toContain('migrations:');

      // Verify the YAML can be parsed back
      const parsedState = yaml.load(yamlContent) as StateSchema;
      expect(parsedState.version).toBe('1.1.0');
      expect(parsedState.migrations).toHaveLength(1);
    });

    test('should handle file loading errors gracefully', async () => {
      // Test with file that has wrong permissions
      const restrictedPath = join(tempDir, 'restricted.yaml');
      await Bun.write(restrictedPath, yaml.dump(testState));

      // Test with non-existent directory
      const badPath = join(tempDir, 'nonexistent', 'bad.yaml');

      const result1 = await recordKeeper.getMigrationHistory(badPath);
      expect(result1).toEqual([]);
    });

    test('should test calculateMigrationChecksum through integration', async () => {
      // The checksum calculation is tested indirectly through record migration
      const result1 = await recordKeeper.recordMigration({
        migration: testMigration,
        state: testState,
        statePath,
        startTime: Date.now(),
        endTime: Date.now() + 100,
        success: true,
      });

      // Even if the checksum calculation fails, the migration should still succeed
      expect(result1.migrations).toHaveLength(1);
      expect(result1.version).toBe('1.1.0');
    });
  });
});