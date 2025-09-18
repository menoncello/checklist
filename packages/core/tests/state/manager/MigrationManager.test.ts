import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { MigrationManager } from '../../../src/state/manager/MigrationManager';
import { DirectoryManager } from '../../../src/state/DirectoryManager';
import { MigrationRunner } from '../../../src/state/migrations/MigrationRunner';
import { BackupManager } from '../../../src/state/BackupManager';
import { SCHEMA_VERSION } from '../../../src/state/constants';
import * as yaml from 'js-yaml';

describe('MigrationManager', () => {
  let migrationManager: MigrationManager;
  let mockDirectoryManager: any;
  let mockMigrationRunner: any;
  let mockBackupManager: any;

  beforeEach(() => {
    // Create mocks for dependencies
    mockDirectoryManager = {
      getStatePath: mock(() => '/test/state.yaml'),
      fileExists: mock(() => Promise.resolve(true)),
      readFile: mock(() => Promise.resolve('version: "1.0.0"\nchecklists: []')),
      writeFile: mock(() => Promise.resolve()),
    };

    mockMigrationRunner = {
      migrateState: mock(() => Promise.resolve({
        version: SCHEMA_VERSION,
        schemaVersion: SCHEMA_VERSION,
        checklists: [],
      })),
    };

    mockBackupManager = {
      listBackups: mock(() => Promise.resolve([
        {
          filename: '/backup/state-v1.0.0.yaml',
          schemaVersion: '1.0.0',
          createdAt: '2024-01-01T00:00:00Z',
          size: 1024,
        },
        {
          filename: '/backup/state-v0.9.0.yaml',
          schemaVersion: '0.9.0',
          createdAt: '2023-12-01T00:00:00Z',
          size: 512,
        },
      ])),
      createBackup: mock(() => Promise.resolve()),
    };

    migrationManager = new MigrationManager(
      mockDirectoryManager as any,
      mockMigrationRunner as any,
      mockBackupManager as any
    );
  });

  describe('checkMigrationStatus', () => {
    it('should return status for existing state file', async () => {
      mockDirectoryManager.readFile = mock(() =>
        Promise.resolve(yaml.dump({ version: '1.0.0', checklists: [] }))
      );

      const status = await migrationManager.checkMigrationStatus();

      expect(status).toEqual({
        currentVersion: '1.0.0',
        latestVersion: SCHEMA_VERSION,
        targetVersion: SCHEMA_VERSION,
        needsMigration: '1.0.0' !== SCHEMA_VERSION,
        availableMigrations: expect.any(Array),
        migrationPath: expect.any(Array),
      });

      expect(mockDirectoryManager.fileExists).toHaveBeenCalledWith('/test/state.yaml');
      expect(mockDirectoryManager.readFile).toHaveBeenCalled();
    });

    it('should return status for non-existent state file', async () => {
      mockDirectoryManager.fileExists = mock(() => Promise.resolve(false));

      const status = await migrationManager.checkMigrationStatus();

      expect(status).toEqual({
        currentVersion: 'none',
        latestVersion: SCHEMA_VERSION,
        targetVersion: SCHEMA_VERSION,
        needsMigration: false,
        availableMigrations: [],
        migrationPath: [],
      });

      expect(mockDirectoryManager.fileExists).toHaveBeenCalled();
      expect(mockDirectoryManager.readFile).not.toHaveBeenCalled();
    });

    it('should handle version detection errors', async () => {
      mockDirectoryManager.readFile = mock(() =>
        Promise.reject(new Error('Read failed'))
      );

      const status = await migrationManager.checkMigrationStatus();

      expect(status.currentVersion).toBe('unknown');
      expect(status.needsMigration).toBe(true); // 'unknown' is always different from SCHEMA_VERSION
    });

    it('should detect available migrations', async () => {
      mockDirectoryManager.readFile = mock(() =>
        Promise.resolve(yaml.dump({ version: '1.0.0', checklists: [] }))
      );

      const status = await migrationManager.checkMigrationStatus();

      if (SCHEMA_VERSION !== '1.0.0') {
        expect(status.availableMigrations.length).toBeGreaterThan(0);
      }
    });

    it('should handle malformed state files', async () => {
      mockDirectoryManager.readFile = mock(() =>
        Promise.resolve('{ invalid: yaml: content }')
      );

      const status = await migrationManager.checkMigrationStatus();

      expect(status.currentVersion).toBe('unknown');
    });
  });

  describe('listBackups', () => {
    it('should list all available backups', async () => {
      const backups = await migrationManager.listBackups();

      expect(backups).toHaveLength(2);
      expect(backups[0]).toEqual({
        path: '/backup/state-v1.0.0.yaml',
        version: '1.0.0',
        timestamp: '2024-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        size: 1024,
      });

      expect(mockBackupManager.listBackups).toHaveBeenCalled();
    });

    it('should handle empty backup list', async () => {
      mockBackupManager.listBackups = mock(() => Promise.resolve([]));

      const backups = await migrationManager.listBackups();

      expect(backups).toEqual([]);
    });

    it('should handle backup listing errors', async () => {
      mockBackupManager.listBackups = mock(() =>
        Promise.reject(new Error('Failed to list'))
      );

      const backups = await migrationManager.listBackups();

      expect(backups).toEqual([]);
    });
  });

  describe('restoreFromBackup', () => {
    it('should restore from backup successfully', async () => {
      const backupPath = '/backup/state-v1.0.0.yaml';
      const backupContent = yaml.dump({ version: '1.0.0', checklists: [] });

      mockDirectoryManager.fileExists = mock((path: string) =>
        Promise.resolve(path === backupPath || path === '/test/state.yaml')
      );
      mockDirectoryManager.readFile = mock((path: string) => {
        if (path === backupPath) return Promise.resolve(backupContent);
        return Promise.resolve(yaml.dump({ version: '2.0.0', checklists: [] }));
      });

      await migrationManager.restoreFromBackup(backupPath);

      expect(mockDirectoryManager.writeFile).toHaveBeenCalledWith(
        '/test/state.yaml',
        backupContent
      );
      expect(mockBackupManager.createBackup).toHaveBeenCalled();
    });

    it('should throw error for non-existent backup file', async () => {
      mockDirectoryManager.fileExists = mock(() => Promise.resolve(false));

      await expect(
        migrationManager.restoreFromBackup('/invalid/backup.yaml')
      ).rejects.toThrow('Backup file not found');
    });

    it('should migrate restored state if needed', async () => {
      const backupPath = '/backup/state-v0.9.0.yaml';
      const backupContent = yaml.dump({ version: '0.9.0', checklists: [] });

      mockDirectoryManager.fileExists = mock(() => Promise.resolve(true));
      mockDirectoryManager.readFile = mock((path: string) => {
        if (path === backupPath) return Promise.resolve(backupContent);
        if (path === '/test/state.yaml') {
          return Promise.resolve(yaml.dump({ version: '0.9.0', checklists: [] }));
        }
        return Promise.resolve('{}');
      });

      // Mock that migration is needed
      (migrationManager as any).checkMigrationStatus = mock(async () => ({
        currentVersion: '0.9.0',
        targetVersion: '1.0.0',
        needsMigration: true,
      }));

      await migrationManager.restoreFromBackup(backupPath);

      expect(mockMigrationRunner.migrateState).toHaveBeenCalled();
    });

    it('should handle restoration without existing state', async () => {
      const backupPath = '/backup/state-v1.0.0.yaml';
      const backupContent = yaml.dump({ version: '1.0.0', checklists: [] });

      mockDirectoryManager.fileExists = mock((path: string) =>
        Promise.resolve(path === backupPath)
      );
      mockDirectoryManager.readFile = mock(() => Promise.resolve(backupContent));

      await migrationManager.restoreFromBackup(backupPath);

      expect(mockBackupManager.createBackup).not.toHaveBeenCalled();
      expect(mockDirectoryManager.writeFile).toHaveBeenCalled();
    });

    it('should handle restoration errors', async () => {
      mockDirectoryManager.fileExists = mock(() => Promise.resolve(true));
      mockDirectoryManager.readFile = mock(() =>
        Promise.reject(new Error('Read failed'))
      );

      await expect(
        migrationManager.restoreFromBackup('/backup/state.yaml')
      ).rejects.toThrow();
    });
  });

  describe('runMigration', () => {
    it('should run migration when needed', async () => {
      const oldState = { version: '0.9.0', checklists: [] };
      const newState = { version: '1.0.0', schemaVersion: '1.0.0', checklists: [] };

      mockDirectoryManager.readFile = mock(() =>
        Promise.resolve(yaml.dump(oldState))
      );
      mockMigrationRunner.migrateState = mock(() => Promise.resolve(newState));

      // Mock that migration is needed
      (migrationManager as any).checkMigrationStatus = mock(async () => ({
        currentVersion: '0.9.0',
        latestVersion: '1.0.0',
        targetVersion: '1.0.0',
        needsMigration: true,
      }));

      await migrationManager.runMigration();

      expect(mockMigrationRunner.migrateState).toHaveBeenCalledWith(
        expect.objectContaining({
          ...oldState,
          lastModified: expect.any(String),
          metadata: expect.objectContaining({
            created: expect.any(String),
            modified: expect.any(String),
          }),
          activeInstance: undefined,
          recovery: undefined,
          conflicts: undefined,
        }),
        '0.9.0',
        '1.0.0'
      );
      expect(mockDirectoryManager.writeFile).toHaveBeenCalledWith(
        '/test/state.yaml',
        expect.any(String)
      );
    });

    it('should skip migration when not needed', async () => {
      (migrationManager as any).checkMigrationStatus = mock(async () => ({
        currentVersion: '1.0.0',
        latestVersion: '1.0.0',
        needsMigration: false,
      }));

      await migrationManager.runMigration();

      expect(mockMigrationRunner.migrateState).not.toHaveBeenCalled();
      expect(mockDirectoryManager.writeFile).not.toHaveBeenCalled();
    });

    it('should throw error when state file does not exist', async () => {
      mockDirectoryManager.fileExists = mock(() => Promise.resolve(false));

      await expect(migrationManager.runMigration()).rejects.toThrow(
        'No state file found to migrate'
      );
    });

    it('should handle migration errors', async () => {
      mockDirectoryManager.readFile = mock(() =>
        Promise.resolve(JSON.stringify({ version: '0.9.0' }))
      );
      mockMigrationRunner.migrateState = mock(() =>
        Promise.reject(new Error('Migration failed'))
      );

      (migrationManager as any).checkMigrationStatus = mock(async () => ({
        currentVersion: '0.9.0',
        latestVersion: '1.0.0',
        needsMigration: true,
      }));

      await expect(migrationManager.runMigration()).rejects.toThrow('Migration failed');
    });

    it('should use targetVersion when latestVersion is not available', async () => {
      const oldState = { version: '0.9.0', checklists: [] };

      mockDirectoryManager.readFile = mock(() =>
        Promise.resolve(yaml.dump(oldState))
      );

      (migrationManager as any).checkMigrationStatus = mock(async () => ({
        currentVersion: '0.9.0',
        latestVersion: undefined,
        targetVersion: '1.0.0',
        needsMigration: true,
      }));

      await migrationManager.runMigration();

      expect(mockMigrationRunner.migrateState).toHaveBeenCalledWith(
        expect.objectContaining({
          ...oldState,
          lastModified: expect.any(String),
          metadata: expect.objectContaining({
            created: expect.any(String),
            modified: expect.any(String),
          }),
          activeInstance: undefined,
          recovery: undefined,
          conflicts: undefined,
        }),
        '0.9.0',
        '1.0.0'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle corrupted YAML in state file', async () => {
      mockDirectoryManager.readFile = mock(() =>
        Promise.resolve('{ invalid: yaml: content }')
      );

      const status = await migrationManager.checkMigrationStatus();
      expect(status.currentVersion).toBe('unknown');
    });

    it('should handle file system errors during migration', async () => {
      mockDirectoryManager.writeFile = mock(() =>
        Promise.reject(new Error('Permission denied'))
      );
      mockDirectoryManager.readFile = mock(() =>
        Promise.resolve(JSON.stringify({ version: '0.9.0' }))
      );

      (migrationManager as any).checkMigrationStatus = mock(async () => ({
        currentVersion: '0.9.0',
        latestVersion: '1.0.0',
        needsMigration: true,
      }));

      await expect(migrationManager.runMigration()).rejects.toThrow('Permission denied');
    });

    it('should handle concurrent backup operations', async () => {
      const promises = [
        migrationManager.listBackups(),
        migrationManager.listBackups(),
        migrationManager.listBackups(),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveLength(2);
      });
    });
  });
});