import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { MigrationRunner } from '../../../src/state/migrations/MigrationRunner';
import { MigrationRegistry } from '../../../src/state/migrations/MigrationRegistry';
import { Migration, MigrationError } from '../../../src/state/migrations/types';

describe('Migration Rollback Scenarios', () => {
  let runner: MigrationRunner;
  let registry: MigrationRegistry;
  const testDir = '/tmp/test-rollback';
  const statePath = path.join(testDir, 'state.yaml');
  const backupDir = path.join(testDir, '.backup');

  beforeEach(async () => {
    registry = new MigrationRegistry();
    runner = new MigrationRunner(registry, backupDir, '2.0.0');

    // Ensure test directories exist
    const { mkdir } = await import('fs/promises');
    await mkdir(testDir, { recursive: true });
    await mkdir(backupDir, { recursive: true });
    
    await Bun.write(path.join(testDir, '.gitkeep'), '');
    await Bun.write(path.join(backupDir, '.gitkeep'), '');
  });

  afterEach(async () => {
    const { rm } = await import('fs/promises');
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('Rollback on Migration Failure', () => {
    it('should rollback when migration validation fails', async () => {
      // Setup migrations where second one will fail validation
      registry.registerMigration({
        fromVersion: '0.0.0',
        toVersion: '1.0.0',
        description: 'First migration (will succeed)',
        up: (state) => ({
          ...(state as Record<string, unknown>),
          version: '1.0.0',
          schemaVersion: '1.0.0',
          metadata: { created: new Date().toISOString() }
        }),
        down: (state) => {
          const { metadata, ...rest } = state as any;
          return { ...rest, version: '0.0.0' };
        }
      });

      registry.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        description: 'Second migration (will fail)',
        up: (state) => ({
          ...(state as Record<string, unknown>),
          version: '2.0.0',
          schemaVersion: '2.0.0',
          invalidField: 'this will fail validation'
        }),
        down: (state) => ({ ...(state as Record<string, unknown>), version: '1.0.0' }),
        validate: (state) => {
          // This validation will always fail
          return false;
        }
      });

      // Create initial state
      const initialState = {
        version: '0.0.0',
        checklists: [
          { id: '1', title: 'Original Checklist', items: [] }
        ]
      };
      await Bun.write(statePath, yaml.dump(initialState));

      // Attempt migration that will fail
      const result = await runner.migrate(statePath, '2.0.0');

      // Verify migration failed
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('validation failed');

      // Verify state was rolled back to original
      const file = Bun.file(statePath);
      const content = await file.text();
      const state = yaml.load(content) as any;

      expect(state.version).toBe('0.0.0');
      expect(state.checklists[0].title).toBe('Original Checklist');
      expect(state.metadata).toBeUndefined(); // Should not have metadata from first migration
    });

    it('should rollback when migration throws an error', async () => {
      registry.registerMigration({
        fromVersion: '0.0.0',
        toVersion: '1.0.0',
        description: 'Migration that throws',
        up: (state) => {
          throw new Error('Simulated migration error');
        },
        down: (state) => state as Record<string, unknown>
      });

      const initialState = {
        version: '0.0.0',
        data: 'original'
      };
      await Bun.write(statePath, yaml.dump(initialState));

      const result = await runner.migrate(statePath, '1.0.0');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Simulated migration error');

      // Verify rollback
      const file = Bun.file(statePath);
      const content = await file.text();
      const state = yaml.load(content) as any;
      expect(state.version).toBe('0.0.0');
      expect(state.data).toBe('original');
    });

    it('should rollback partial migration on failure', async () => {
      // Three migrations, third will fail
      registry.registerMigration({
        fromVersion: '0.0.0',
        toVersion: '1.0.0',
        description: 'First',
        up: (state) => ({ ...(state as Record<string, unknown>), version: '1.0.0', step1: true }),
        down: (state) => {
          const { step1, ...rest } = state as any;
          return { ...rest, version: '0.0.0' };
        }
      });

      registry.registerMigration({
        fromVersion: '1.0.0',
        toVersion: '1.5.0',
        description: 'Second',
        up: (state) => ({ ...(state as Record<string, unknown>), version: '1.5.0', step2: true }),
        down: (state) => {
          const { step2, ...rest } = state as any;
          return { ...rest, version: '1.0.0' };
        }
      });

      registry.registerMigration({
        fromVersion: '1.5.0',
        toVersion: '2.0.0',
        description: 'Third (will fail)',
        up: (state) => {
          throw new Error('Third migration failed');
        },
        down: (state) => ({ ...(state as Record<string, unknown>), version: '1.5.0' })
      });

      const initialState = {
        version: '0.0.0',
        important: 'data'
      };
      await Bun.write(statePath, yaml.dump(initialState));

      const result = await runner.migrate(statePath, '2.0.0');

      expect(result.success).toBe(false);
      
      // Should rollback to initial state
      const file = Bun.file(statePath);
      const content = await file.text();
      const state = yaml.load(content) as any;
      
      expect(state.version).toBe('0.0.0');
      expect(state.important).toBe('data');
      expect(state.step1).toBeUndefined();
      expect(state.step2).toBeUndefined();
    });

    it('should emit rollback events', async () => {
      registry.registerMigration({
        fromVersion: '0.0.0',
        toVersion: '1.0.0',
        description: 'Failing migration',
        up: () => {
          throw new Error('Intentional failure');
        },
        down: (state) => state as Record<string, unknown>
      });

      const initialState = { version: '0.0.0' };
      await Bun.write(statePath, yaml.dump(initialState));

      const events: string[] = [];
      runner.on('rollback:start', () => events.push('rollback:start'));
      runner.on('rollback:complete', () => events.push('rollback:complete'));
      runner.on('migration:error', () => events.push('migration:error'));

      await runner.migrate(statePath, '1.0.0');

      expect(events).toContain('migration:error');
      expect(events).toContain('rollback:start');
      expect(events).toContain('rollback:complete');
    });

    it('should handle rollback failure gracefully', async () => {
      registry.registerMigration({
        fromVersion: '0.0.0',
        toVersion: '1.0.0',
        description: 'Migration',
        up: () => {
          throw new Error('Migration failed');
        },
        down: (state) => state as Record<string, unknown>
      });

      const initialState = { version: '0.0.0' };
      await Bun.write(statePath, yaml.dump(initialState));

      // Mock rollback to fail
      const originalRollback = runner.rollback;
      runner.rollback = async () => {
        throw new Error('Rollback also failed');
      };

      const result = await runner.migrate(statePath, '1.0.0');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      
      // Restore original rollback
      runner.rollback = originalRollback;
    });
  });

  describe('Backup Integrity During Rollback', () => {
    it('should preserve backup file after rollback', async () => {
      registry.registerMigration({
        fromVersion: '0.0.0',
        toVersion: '1.0.0',
        description: 'Failing migration',
        up: () => {
          throw new Error('Failed');
        },
        down: (state) => state as Record<string, unknown>
      });

      const initialState = {
        version: '0.0.0',
        preserve: 'this data'
      };
      await Bun.write(statePath, yaml.dump(initialState));

      const result = await runner.migrate(statePath, '1.0.0');

      expect(result.success).toBe(false);

      // Check that backup still exists
      const backups = await runner.listBackups();
      expect(backups.length).toBeGreaterThan(0);

      // Verify backup content matches original
      const backupFile = Bun.file(backups[0].path);
      const backupContent = await backupFile.text();
      const backupState = yaml.load(backupContent) as any;
      
      expect(backupState.version).toBe('0.0.0');
      expect(backupState.preserve).toBe('this data');
    });

    it('should create backup even when migration fails immediately', async () => {
      registry.registerMigration({
        fromVersion: '0.0.0',
        toVersion: '1.0.0',
        description: 'Immediate failure',
        up: () => {
          throw new Error('Immediate failure');
        },
        down: (state) => state as Record<string, unknown>
      });

      const initialState = { version: '0.0.0' };
      await Bun.write(statePath, yaml.dump(initialState));

      await runner.migrate(statePath, '1.0.0');

      const backups = await runner.listBackups();
      expect(backups.length).toBe(1);
      expect(backups[0].version).toBe('0.0.0');
    });
  });

  describe('Complex Rollback Scenarios', () => {
    it('should handle corrupted state during migration', async () => {
      registry.registerMigration({
        fromVersion: '0.0.0',
        toVersion: '1.0.0',
        description: 'Corrupting migration',
        up: (state) => {
          // Return invalid state structure
          return null as any;
        },
        down: (state) => state as Record<string, unknown>,
        validate: (state) => state !== null && typeof state === 'object'
      });

      const initialState = {
        version: '0.0.0',
        valid: true
      };
      await Bun.write(statePath, yaml.dump(initialState));

      const result = await runner.migrate(statePath, '1.0.0');

      expect(result.success).toBe(false);

      // State should be rolled back
      const file = Bun.file(statePath);
      const content = await file.text();
      const state = yaml.load(content) as any;
      expect(state.valid).toBe(true);
    });

    it('should handle multiple validation failures in sequence', async () => {
      let attempt = 0;

      registry.registerMigration({
        fromVersion: '0.0.0',
        toVersion: '1.0.0',
        description: 'Flaky migration',
        up: (state) => {
          attempt++;
          return { ...(state as Record<string, unknown>), version: '1.0.0', attempt };
        },
        down: (state) => ({ ...(state as Record<string, unknown>), version: '0.0.0' }),
        validate: () => {
          // Fail first two attempts
          return attempt > 2;
        }
      });

      const initialState = { version: '0.0.0' };
      await Bun.write(statePath, yaml.dump(initialState));

      // First attempt should fail
      const result1 = await runner.migrate(statePath, '1.0.0');
      expect(result1.success).toBe(false);

      // Second attempt should also fail
      const result2 = await runner.migrate(statePath, '1.0.0');
      expect(result2.success).toBe(false);

      // Third attempt should succeed
      const result3 = await runner.migrate(statePath, '1.0.0');
      expect(result3.success).toBe(true);
    });

    it('should not create backup when createBackup option is false', async () => {
      registry.registerMigration({
        fromVersion: '0.0.0',
        toVersion: '1.0.0',
        description: 'Migration without backup',
        up: () => {
          throw new Error('Will fail');
        },
        down: (state) => state as Record<string, unknown>
      });

      const initialState = { version: '0.0.0' };
      await Bun.write(statePath, yaml.dump(initialState));

      const result = await runner.migrate(statePath, '1.0.0', { 
        createBackup: false 
      });

      expect(result.success).toBe(false);
      expect(result.backupPath).toBeUndefined();

      // No backups should exist
      const backups = await runner.listBackups();
      expect(backups.length).toBe(0);
    });
  });
});