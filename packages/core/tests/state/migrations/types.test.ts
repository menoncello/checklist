import { describe, it, expect } from 'bun:test';
import {
  MigrationError,
  VersionDetectionError,
  compareVersions,
  formatVersion,
  parseVersion,
  type Migration,
  type MigrationOptions,
  type MigrationResult,
  type MigrationPath,
  type MigrationProgress,
  type BackupInfo,
  type StateSchema,
  type MigrationRecord,
  type MigrationEvent,
  type MigrationEventType
} from '../../../src/state/migrations/types';

describe('Migration Types', () => {
  describe('MigrationError', () => {
    it('should create error with correct properties', () => {
      const fromVersion = '1.0.0';
      const toVersion = '2.0.0';
      const message = 'Migration failed';
      const cause = new Error('Original error');

      const error = new MigrationError(message, fromVersion, toVersion, cause);

      expect(error.message).toBe(message);
      expect(error.name).toBe('MigrationError');
      expect(error.fromVersion).toBe(fromVersion);
      expect(error.toVersion).toBe(toVersion);
      expect(error.cause).toBe(cause);
      expect(error instanceof Error).toBe(true);
    });

    it('should create error without cause', () => {
      const fromVersion = '1.0.0';
      const toVersion = '2.0.0';
      const message = 'Migration failed';

      const error = new MigrationError(message, fromVersion, toVersion);

      expect(error.message).toBe(message);
      expect(error.name).toBe('MigrationError');
      expect(error.fromVersion).toBe(fromVersion);
      expect(error.toVersion).toBe(toVersion);
      expect(error.cause).toBeUndefined();
    });
  });

  describe('VersionDetectionError', () => {
    it('should create error with correct properties', () => {
      const message = 'Version detection failed';
      const error = new VersionDetectionError(message);

      expect(error.message).toBe(message);
      expect(error.name).toBe('VersionDetectionError');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('compareVersions', () => {
    it('should return 0 for equal versions', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(compareVersions('2.1.3', '2.1.3')).toBe(0);
      expect(compareVersions('0.0.1', '0.0.1')).toBe(0);
    });

    it('should return -1 when first version is lower', () => {
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
      expect(compareVersions('1.2.0', '1.3.0')).toBe(-1);
      expect(compareVersions('1.2.3', '1.2.4')).toBe(-1);
      expect(compareVersions('0.9.9', '1.0.0')).toBe(-1);
    });

    it('should return 1 when first version is higher', () => {
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
      expect(compareVersions('1.3.0', '1.2.0')).toBe(1);
      expect(compareVersions('1.2.4', '1.2.3')).toBe(1);
      expect(compareVersions('1.0.0', '0.9.9')).toBe(1);
    });

    it('should handle versions with different part counts', () => {
      expect(compareVersions('1.0', '1.0.0')).toBe(0);
      expect(compareVersions('1.1', '1.0.0')).toBe(1);
      expect(compareVersions('1.0.0', '1.1')).toBe(-1);
      expect(compareVersions('2', '1.9.9')).toBe(1);
      expect(compareVersions('1', '2.0.0')).toBe(-1);
    });

    it('should handle edge cases', () => {
      expect(compareVersions('0.0.0', '0.0.0')).toBe(0);
      expect(compareVersions('10.0.0', '9.0.0')).toBe(1);
      expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    });
  });

  describe('formatVersion', () => {
    it('should format version correctly', () => {
      expect(formatVersion(1, 0, 0)).toBe('1.0.0');
      expect(formatVersion(2, 1, 3)).toBe('2.1.3');
      expect(formatVersion(10, 5, 12)).toBe('10.5.12');
      expect(formatVersion(0, 0, 1)).toBe('0.0.1');
    });

    it('should handle zero values', () => {
      expect(formatVersion(0, 0, 0)).toBe('0.0.0');
      expect(formatVersion(1, 0, 0)).toBe('1.0.0');
      expect(formatVersion(0, 1, 0)).toBe('0.1.0');
      expect(formatVersion(0, 0, 1)).toBe('0.0.1');
    });

    it('should handle large numbers', () => {
      expect(formatVersion(99, 99, 99)).toBe('99.99.99');
      expect(formatVersion(1000, 2000, 3000)).toBe('1000.2000.3000');
    });
  });

  describe('parseVersion', () => {
    it('should parse version correctly', () => {
      expect(parseVersion('1.0.0')).toEqual({ major: 1, minor: 0, patch: 0 });
      expect(parseVersion('2.1.3')).toEqual({ major: 2, minor: 1, patch: 3 });
      expect(parseVersion('10.5.12')).toEqual({ major: 10, minor: 5, patch: 12 });
    });

    it('should handle missing parts with defaults', () => {
      expect(parseVersion('1')).toEqual({ major: 1, minor: 0, patch: 0 });
      expect(parseVersion('1.2')).toEqual({ major: 1, minor: 2, patch: 0 });
      expect(parseVersion('')).toEqual({ major: 0, minor: 0, patch: 0 });
    });

    it('should handle invalid input gracefully', () => {
      expect(parseVersion('invalid')).toEqual({ major: NaN, minor: 0, patch: 0 });
      expect(parseVersion('1.x.3')).toEqual({ major: 1, minor: NaN, patch: 3 });
      expect(parseVersion('a.b.c')).toEqual({ major: NaN, minor: NaN, patch: NaN });
    });

    it('should handle edge cases', () => {
      expect(parseVersion('0.0.0')).toEqual({ major: 0, minor: 0, patch: 0 });
      expect(parseVersion('1.0.0-beta')).toEqual({ major: 1, minor: 0, patch: NaN });
    });
  });

  describe('Interface type safety', () => {
    it('should type Migration interface correctly', () => {
      const migration: Migration = {
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        description: 'Test migration',
        up: (state: unknown) => state as Record<string, unknown>,
        down: (state: unknown) => state as Record<string, unknown>
      };

      expect(migration.fromVersion).toBe('1.0.0');
      expect(migration.toVersion).toBe('2.0.0');
      expect(migration.description).toBe('Test migration');
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });

    it('should type MigrationOptions interface correctly', () => {
      const options: MigrationOptions = {
        dryRun: true,
        createBackup: false,
        verbose: true
      };

      expect(options.dryRun).toBe(true);
      expect(options.createBackup).toBe(false);
      expect(options.verbose).toBe(true);
    });

    it('should type MigrationResult interface correctly', () => {
      const result: MigrationResult = {
        success: true,
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        appliedMigrations: ['migration-1', 'migration-2']
      };

      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe('1.0.0');
      expect(result.toVersion).toBe('2.0.0');
      expect(result.appliedMigrations).toEqual(['migration-1', 'migration-2']);
    });

    it('should type MigrationPath interface correctly', () => {
      const path: MigrationPath = {
        migrations: [],
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        totalSteps: 2
      };

      expect(Array.isArray(path.migrations)).toBe(true);
      expect(path.fromVersion).toBe('1.0.0');
      expect(path.toVersion).toBe('2.0.0');
      expect(path.totalSteps).toBe(2);
    });

    it('should type MigrationProgress interface correctly', () => {
      const progress: MigrationProgress = {
        currentStep: 1,
        totalSteps: 3,
        currentMigration: 'test-migration',
        percentage: 33.33
      };

      expect(progress.currentStep).toBe(1);
      expect(progress.totalSteps).toBe(3);
      expect(progress.currentMigration).toBe('test-migration');
      expect(progress.percentage).toBe(33.33);
    });

    it('should type BackupInfo interface correctly', () => {
      const backup: BackupInfo = {
        path: '/path/to/backup',
        version: '1.0.0',
        timestamp: '2023-01-01T00:00:00Z',
        size: 1024
      };

      expect(backup.path).toBe('/path/to/backup');
      expect(backup.version).toBe('1.0.0');
      expect(backup.timestamp).toBe('2023-01-01T00:00:00Z');
      expect(backup.size).toBe(1024);
    });

    it('should type StateSchema interface correctly', () => {
      const schema: StateSchema = {
        schemaVersion: '1.0.0',
        version: '1.0.0',
        lastModified: '2023-01-01T00:00:00Z'
      };

      expect(schema.schemaVersion).toBe('1.0.0');
      expect(schema.version).toBe('1.0.0');
      expect(schema.lastModified).toBe('2023-01-01T00:00:00Z');
    });

    it('should type MigrationRecord interface correctly', () => {
      const record: MigrationRecord = {
        from: '1.0.0',
        to: '2.0.0',
        applied: '2023-01-01T00:00:00Z'
      };

      expect(record.from).toBe('1.0.0');
      expect(record.to).toBe('2.0.0');
      expect(record.applied).toBe('2023-01-01T00:00:00Z');
    });

    it('should type MigrationEvent interface correctly', () => {
      const event: MigrationEvent = {
        type: 'migration:start',
        data: { test: 'data' },
        timestamp: '2023-01-01T00:00:00Z'
      };

      expect(event.type).toBe('migration:start');
      expect(event.data).toEqual({ test: 'data' });
      expect(event.timestamp).toBe('2023-01-01T00:00:00Z');
    });
  });

  describe('MigrationEventType union type', () => {
    it('should accept all valid event types', () => {
      const eventTypes: MigrationEventType[] = [
        'migration:start',
        'migration:progress',
        'migration:complete',
        'migration:error',
        'backup:created',
        'rollback:start',
        'rollback:complete'
      ];

      eventTypes.forEach(type => {
        const event: MigrationEvent = {
          type,
          data: {},
          timestamp: '2023-01-01T00:00:00Z'
        };
        expect(event.type).toBe(type);
      });
    });
  });

  describe('Function integration tests', () => {
    it('should work together for version lifecycle', () => {
      // Format and parse should be inverse operations
      const major = 2;
      const minor = 1;
      const patch = 3;

      const formatted = formatVersion(major, minor, patch);
      const parsed = parseVersion(formatted);

      expect(parsed.major).toBe(major);
      expect(parsed.minor).toBe(minor);
      expect(parsed.patch).toBe(patch);
    });

    it('should integrate with version comparison', () => {
      const v1 = formatVersion(1, 0, 0);
      const v2 = formatVersion(2, 0, 0);
      const v3 = formatVersion(1, 0, 0);

      expect(compareVersions(v1, v2)).toBe(-1);
      expect(compareVersions(v2, v1)).toBe(1);
      expect(compareVersions(v1, v3)).toBe(0);
    });

    it('should handle complex version comparison scenarios', () => {
      const versions = ['1.0.0', '1.0.1', '1.1.0', '2.0.0'];

      // Test ascending order
      for (let i = 0; i < versions.length - 1; i++) {
        expect(compareVersions(versions[i], versions[i + 1])).toBe(-1);
      }

      // Test descending order
      for (let i = versions.length - 1; i > 0; i--) {
        expect(compareVersions(versions[i], versions[i - 1])).toBe(1);
      }
    });
  });
});