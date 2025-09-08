import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { MigrationRunner } from '../../../src/state/migrations/MigrationRunner';
import { MigrationRegistry } from '../../../src/state/migrations/MigrationRegistry';
import { Migration } from '../../../src/state/migrations/types';

describe('MigrationRunner', () => {
  let runner: MigrationRunner;
  let registry: MigrationRegistry;
  const testDir = '/tmp/test-migrations';
  const statePath = path.join(testDir, 'state.yaml');
  const backupDir = path.join(testDir, '.backup');

  beforeEach(async () => {
    registry = new MigrationRegistry();
    runner = new MigrationRunner(registry, backupDir);

    // Ensure directories exist
    const { mkdir } = await import('fs/promises');
    await mkdir(testDir, { recursive: true });
    await mkdir(backupDir, { recursive: true });
    
    await Bun.write(path.join(testDir, '.gitkeep'), '');
    await Bun.write(path.join(backupDir, '.gitkeep'), '');

    const migrations: Migration[] = [
      {
        fromVersion: '0.0.0',
        toVersion: '0.1.0',
        description: 'Initial schema',
        up: (state) => ({
          ...(state as Record<string, unknown>),
          version: '0.1.0',
          metadata: {
            created: new Date().toISOString(),
            modified: new Date().toISOString()
          }
        }),
        down: (state) => {
          const { metadata, ...rest } = state as any;
          return { ...rest, version: '0.0.0' };
        },
        validate: (state) => (state as any).metadata !== undefined
      },
      {
        fromVersion: '0.1.0',
        toVersion: '0.2.0',
        description: 'Add templates',
        up: (state) => ({
          ...(state as Record<string, unknown>),
          version: '0.2.0',
          templates: [],
          variables: {}
        }),
        down: (state) => {
          const { templates, variables, ...rest } = state as any;
          return { ...rest, version: '0.1.0' };
        },
        validate: (state) => Array.isArray((state as any).templates)
      },
      {
        fromVersion: '0.2.0',
        toVersion: '1.0.0',
        description: 'Major release',
        up: (state) => ({
          ...(state as Record<string, unknown>),
          version: '1.0.0',
          schemaVersion: '1.0.0',
          recovery: null,
          conflicts: []
        }),
        down: (state) => {
          const { recovery, conflicts, schemaVersion, ...rest } = state as any;
          return { ...rest, version: '0.2.0' };
        }
      }
    ];

    migrations.forEach(m => registry.registerMigration(m));
  });

  afterEach(async () => {
    const { rm } = await import('fs/promises');
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('migrate', () => {
    it('should migrate from 0.0.0 to 1.0.0', async () => {
      const initialState = {
        version: '0.0.0',
        checklists: []
      };
      await Bun.write(statePath, yaml.dump(initialState));

      const result = await runner.migrate(statePath, '1.0.0');

      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe('0.0.0');
      expect(result.toVersion).toBe('1.0.0');
      expect(result.appliedMigrations).toHaveLength(3);

      const file = Bun.file(statePath);
      const content = await file.text();
      const state = yaml.load(content) as any;
      
      expect(state.version).toBe('1.0.0');
      expect(state.schemaVersion).toBe('1.0.0');
      expect(state.templates).toEqual([]);
      expect(state.variables).toEqual({});
      expect(state.metadata).toBeDefined();
      expect(state.recovery).toBeNull();
      expect(state.conflicts).toEqual([]);
    });

    it('should skip migration if already at target version', async () => {
      const state = {
        version: '1.0.0',
        schemaVersion: '1.0.0'
      };
      await Bun.write(statePath, yaml.dump(state));

      const result = await runner.migrate(statePath, '1.0.0');

      expect(result.success).toBe(true);
      expect(result.appliedMigrations).toHaveLength(0);
    });

    it('should handle dry run without applying changes', async () => {
      const initialState = {
        version: '0.0.0',
        checklists: []
      };
      await Bun.write(statePath, yaml.dump(initialState));

      const result = await runner.migrate(statePath, '1.0.0', { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.appliedMigrations).toHaveLength(3);

      const file = Bun.file(statePath);
      const content = await file.text();
      const state = yaml.load(content) as any;
      
      expect(state.version).toBe('0.0.0');
    });

    it('should create backup before migration', async () => {
      const initialState = {
        version: '0.0.0',
        checklists: []
      };
      await Bun.write(statePath, yaml.dump(initialState));

      const result = await runner.migrate(statePath, '0.1.0', { createBackup: true });

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeDefined();
      
      if (result.backupPath) {
        const backupFile = Bun.file(result.backupPath);
        const exists = await backupFile.exists();
        expect(exists).toBe(true);
        
        const content = await backupFile.text();
        const backupState = yaml.load(content) as any;
        expect(backupState.version).toBe('0.0.0');
      }
    });

    it('should rollback on migration failure', async () => {
      const failingMigration: Migration = {
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        description: 'Failing migration',
        up: () => {
          throw new Error('Migration failed');
        },
        down: (state) => state as Record<string, unknown>
      };
      registry.registerMigration(failingMigration);

      const initialState = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        important: 'data'
      };
      await Bun.write(statePath, yaml.dump(initialState));

      const result = await runner.migrate(statePath, '2.0.0');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      const file = Bun.file(statePath);
      const content = await file.text();
      const state = yaml.load(content) as any;
      
      expect(state.version).toBe('1.0.0');
      expect(state.important).toBe('data');
    });

    it('should validate migration if validator provided', async () => {
      const invalidMigration: Migration = {
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        description: 'Invalid migration',
        up: (state) => ({ ...(state as Record<string, unknown>), version: '2.0.0' }),
        down: (state) => state as Record<string, unknown>,
        validate: () => false
      };
      registry.registerMigration(invalidMigration);

      const initialState = {
        version: '1.0.0',
        schemaVersion: '1.0.0'
      };
      await Bun.write(statePath, yaml.dump(initialState));

      const result = await runner.migrate(statePath, '2.0.0');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('validation failed');
    });

    it('should emit progress events', async () => {
      const initialState = {
        version: '0.0.0',
        checklists: []
      };
      await Bun.write(statePath, yaml.dump(initialState));

      const progressEvents: any[] = [];
      runner.on('migration:progress', (progress) => {
        progressEvents.push(progress);
      });

      await runner.migrate(statePath, '1.0.0');

      expect(progressEvents).toHaveLength(3);
      expect(progressEvents[0].currentStep).toBe(1);
      expect(progressEvents[0].totalSteps).toBe(3);
      expect(progressEvents[2].percentage).toBe(100);
    });

    it('should handle non-existent state file', async () => {
      const nonExistentPath = path.join(testDir, 'non-existent.yaml');
      
      const result = await runner.migrate(nonExistentPath, '1.0.0');

      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe('0.0.0');
      expect(result.toVersion).toBe('1.0.0');
    });

    it('should track migration history', async () => {
      const initialState = {
        version: '0.0.0',
        checklists: []
      };
      await Bun.write(statePath, yaml.dump(initialState));

      await runner.migrate(statePath, '1.0.0');

      const file = Bun.file(statePath);
      const content = await file.text();
      const state = yaml.load(content) as any;
      
      expect(state.migrations).toBeDefined();
      expect(state.migrations).toHaveLength(3);
      expect(state.migrations[0].from).toBe('0.0.0');
      expect(state.migrations[0].to).toBe('0.1.0');
      expect(state.migrations[0].applied).toBeDefined();
    });
  });

  describe('createBackup', () => {
    it('should create backup file with timestamp', async () => {
      const state = { version: '1.0.0', data: 'test' };
      await Bun.write(statePath, yaml.dump(state));

      const backupPath = await runner.createBackup(statePath, '1.0.0');

      expect(backupPath).toContain('state-v1.0.0-');
      expect(backupPath).toContain('.yaml');

      const backupFile = Bun.file(backupPath);
      const exists = await backupFile.exists();
      expect(exists).toBe(true);
    });

    it('should rotate old backups', async () => {
      runner.setMaxBackups(3);

      const state = { version: '1.0.0', data: 'test' };
      await Bun.write(statePath, yaml.dump(state));

      const backupPaths: string[] = [];
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 10));
        const path = await runner.createBackup(statePath, `1.0.${i}`);
        backupPaths.push(path);
      }

      const backups = await runner.listBackups();
      expect(backups.length).toBeLessThanOrEqual(3);
    });
  });

  describe('listBackups', () => {
    it('should list all backup files', async () => {
      const state = { version: '1.0.0', data: 'test' };
      await Bun.write(statePath, yaml.dump(state));

      await runner.createBackup(statePath, '1.0.0');
      await new Promise(resolve => setTimeout(resolve, 10));
      await runner.createBackup(statePath, '1.1.0');

      const backups = await runner.listBackups();

      expect(backups).toHaveLength(2);
      expect(backups[0].version).toBeDefined();
      expect(backups[0].timestamp).toBeDefined();
      expect(backups[0].size).toBeGreaterThan(0);
    });

    it('should sort backups by timestamp descending', async () => {
      const state = { version: '1.0.0', data: 'test' };
      await Bun.write(statePath, yaml.dump(state));

      await runner.createBackup(statePath, '1.0.0');
      await new Promise(resolve => setTimeout(resolve, 100));
      await runner.createBackup(statePath, '1.1.0');

      const backups = await runner.listBackups();

      expect(backups[0].version).toBe('1.1.0');
      expect(backups[1].version).toBe('1.0.0');
    });
  });

  describe('rollback', () => {
    it('should restore state from backup', async () => {
      const originalState = { version: '1.0.0', original: true };
      await Bun.write(statePath, yaml.dump(originalState));
      
      const backupPath = await runner.createBackup(statePath, '1.0.0');

      const newState = { version: '2.0.0', original: false };
      await Bun.write(statePath, yaml.dump(newState));

      await runner.rollback(statePath, backupPath);

      const file = Bun.file(statePath);
      const content = await file.text();
      const state = yaml.load(content) as any;
      
      expect(state.version).toBe('1.0.0');
      expect(state.original).toBe(true);
    });

    it('should emit rollback events', async () => {
      const state = { version: '1.0.0' };
      await Bun.write(statePath, yaml.dump(state));
      
      const backupPath = await runner.createBackup(statePath, '1.0.0');

      let rollbackStarted = false;
      let rollbackCompleted = false;

      runner.on('rollback:start', () => { rollbackStarted = true; });
      runner.on('rollback:complete', () => { rollbackCompleted = true; });

      await runner.rollback(statePath, backupPath);

      expect(rollbackStarted).toBe(true);
      expect(rollbackCompleted).toBe(true);
    });
  });
});