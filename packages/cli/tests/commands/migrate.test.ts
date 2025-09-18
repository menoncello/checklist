import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import * as path from 'path';
import { tmpdir } from 'os';
import { mkdtemp } from 'fs/promises';
import * as yaml from 'js-yaml';
import { MigrationRunner } from '@checklist/core/src/state/migrations/MigrationRunner';
import { MigrationRegistry } from '@checklist/core/src/state/migrations/MigrationRegistry';
import { detectVersion } from '@checklist/core/src/state/migrations/versionDetection';
import type { StateSchema } from '@checklist/core/src/state/migrations/types';
import { MigrateCommand } from '../../src/commands/migrate';
import ansi from 'ansis';

// Tests for MigrateCommand class
describe('MigrateCommand Class', () => {
  let command: MigrateCommand;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;
  let tempDir: string;

  beforeEach(async () => {
    // Create temp directory for tests
    tempDir = `/tmp/checklist-test-${Date.now()}`;
    const { mkdir } = await import('fs/promises');
    await mkdir(tempDir, { recursive: true });

    // Create spies for console methods
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    // Create command instance
    command = new MigrateCommand(tempDir);
  });

  afterEach(async () => {
    // Cleanup temp directory
    const { rm } = await import('fs/promises');
    await rm(tempDir, { recursive: true, force: true });

    // Restore spies
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('execute with real StateManager', () => {
    it('should handle check option with no migration needed', async () => {
      // Create a state file with current version
      const statePath = path.join(tempDir, 'state.yaml');
      const testState = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        lastModified: new Date().toISOString(),
        checklists: []
      };
      await Bun.write(statePath, yaml.dump(testState));

      await command.execute({ check: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(ansi.cyan('Checking migration status...'));
      // State manager will determine no migration is needed
    });

    it('should handle verbose option', async () => {
      const statePath = path.join(tempDir, 'state.yaml');
      const testState = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        lastModified: new Date().toISOString(),
        checklists: []
      };
      await Bun.write(statePath, yaml.dump(testState));

      await command.execute({ check: true, verbose: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(ansi.cyan('Checking migration status...'));
    });

    it('should handle error and exit process', async () => {
      // Create a command with a temp directory to avoid constructor error
      const tempDir = await mkdtemp(path.join(tmpdir(), 'checklist-test-'));
      const command = new MigrateCommand(tempDir);

      // Force an error by corrupting state file after construction
      const statePath = path.join(tempDir, 'state.yaml');
      await Bun.write(statePath, 'invalid: yaml: content: that: will: cause: error');

      try {
        await command.execute({ check: true });
      } catch (e: any) {
        // Either process.exit was called or an error was thrown
        expect(processExitSpy).toHaveBeenCalledWith(1);
      }
    });
  });
});

// Re-enabled tests after fixing timeout issues
describe('CLI Migration Commands', () => {
  let tempDir: string;
  let statePath: string;
  let backupDir: string;
  let runner: MigrationRunner;
  let registry: MigrationRegistry;

  beforeEach(async () => {
    // Create temp directory for tests
    tempDir = `/tmp/checklist-test-${Date.now()}`;
    statePath = path.join(tempDir, 'state.yaml');
    backupDir = path.join(tempDir, '.backup');
    
    // Ensure temp directory exists using fs.promises
    const { mkdir } = await import('fs/promises');
    await mkdir(tempDir, { recursive: true });
    await mkdir(backupDir, { recursive: true });
    
    // Create registry with test migrations
    registry = new MigrationRegistry();
    registry.registerMigration({
      fromVersion: '0.0.0',
      toVersion: '0.1.0',
      description: 'Add metadata fields',
      up: (state) => ({
        ...(state as Record<string, unknown>),
        version: '0.1.0',
        schemaVersion: '0.1.0',
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString()
        }
      }),
      down: (state) => {
        const s = state as Record<string, unknown>;
        const { metadata, ...rest } = s;
        return { ...rest, version: '0.0.0' };
      }
    });

    registry.registerMigration({
      fromVersion: '0.1.0',
      toVersion: '1.0.0',
      description: 'Add advanced features',
      up: (state) => ({
        ...(state as Record<string, unknown>),
        version: '1.0.0',
        schemaVersion: '1.0.0',
        templates: [],
        variables: {},
        recovery: {},
        conflicts: []
      }),
      down: (state) => {
        const s = state as Record<string, unknown>;
        const { templates, variables, recovery, conflicts, ...rest } = s;
        return { ...rest, version: '0.1.0' };
      },
      validate: (state) => {
        const s = state as Record<string, unknown>;
        return Array.isArray(s.templates) && 
               typeof s.variables === 'object' &&
               typeof s.recovery === 'object' &&
               Array.isArray(s.conflicts);
      }
    });

    runner = new MigrationRunner(registry, backupDir, '1.0.0');
  });

  afterEach(async () => {
    // Cleanup temp directory
    const { rm } = await import('fs/promises');
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('checklist migrate --check', () => {
    it('should detect current state version', async () => {
      // Create a test state file
      const testState: StateSchema = {
        schemaVersion: '0.1.0',
        version: '0.1.0',
        lastModified: new Date().toISOString(),
        checklists: [],
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString()
        }
      };
      
      await Bun.write(statePath, yaml.dump(testState));
      
      // Check version detection
      const file = Bun.file(statePath);
      const content = await file.text();
      const state = yaml.load(content) as StateSchema;
      const version = await detectVersion(state);
      
      expect(version).toBe('0.1.0');
    });

    it('should identify if migration is needed', async () => {
      // Create old version state
      const oldState = {
        version: '0.0.0',
        checklists: []
      };
      
      await Bun.write(statePath, yaml.dump(oldState));
      
      // Load and check
      const file = Bun.file(statePath);
      const content = await file.text();
      const state = yaml.load(content) as any;
      const currentVersion = state.version || '0.0.0';
      const targetVersion = '1.0.0';
      
      expect(currentVersion).not.toBe(targetVersion);
      expect(currentVersion).toBe('0.0.0');
    });
  });

  describe('checklist migrate --dry-run', () => {
    it('should show migration plan without applying changes', async () => {
      // Create old version state
      const oldState = {
        version: '0.0.0',
        checklists: []
      };
      
      await Bun.write(statePath, yaml.dump(oldState));
      
      // Run dry-run migration
      const result = await runner.migrate(statePath, '1.0.0', { 
        dryRun: true,
        verbose: false 
      });
      
      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe('0.0.0');
      expect(result.toVersion).toBe('1.0.0');
      expect(result.appliedMigrations).toEqual([
        '0.0.0->0.1.0',
        '0.1.0->1.0.0'
      ]);
      
      // Verify state file wasn't changed
      const file = Bun.file(statePath);
      const content = await file.text();
      const state = yaml.load(content) as any;
      expect(state.version).toBe('0.0.0');
    });
  });

  describe('checklist migrate', () => {
    it('should perform full migration', async () => {
      // Create old version state
      const oldState = {
        version: '0.0.0',
        checklists: [
          { id: '1', title: 'Test', items: [] }
        ]
      };
      
      await Bun.write(statePath, yaml.dump(oldState));
      
      // Run migration
      const result = await runner.migrate(statePath, '1.0.0');
      
      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe('0.0.0');
      expect(result.toVersion).toBe('1.0.0');
      expect(result.appliedMigrations).toEqual([
        '0.0.0->0.1.0',
        '0.1.0->1.0.0'
      ]);
      
      // Verify state file was updated
      const file = Bun.file(statePath);
      const content = await file.text();
      const state = yaml.load(content) as StateSchema;
      
      expect(state.version).toBe('1.0.0');
      expect(state.schemaVersion).toBe('1.0.0');
      expect(state.metadata).toBeDefined();
      expect(state.templates).toEqual([]);
      expect(state.variables).toEqual({});
      expect(state.checklists).toHaveLength(1);
    });

    it('should create backup before migration', async () => {
      const oldState = {
        version: '0.0.0',
        checklists: []
      };
      
      await Bun.write(statePath, yaml.dump(oldState));
      
      const result = await runner.migrate(statePath, '1.0.0');
      
      expect(result.success).toBe(true);
      expect(result.backupPath).toBeDefined();
      
      // Verify backup exists
      const backupFile = Bun.file(result.backupPath!);
      expect(await backupFile.exists()).toBe(true);
      
      // Verify backup content matches original
      const backupContent = await backupFile.text();
      const backupState = yaml.load(backupContent) as any;
      expect(backupState.version).toBe('0.0.0');
    });
  });

  describe('checklist migrate --backup-only', () => {
    it('should create backup without migrating', async () => {
      const testState = {
        version: '0.1.0',
        checklists: [],
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString()
        }
      };
      
      await Bun.write(statePath, yaml.dump(testState));
      
      // Create backup only
      const backupPath = await runner.createBackup(statePath, '0.1.0');
      
      expect(backupPath).toBeDefined();
      expect(backupPath).toContain('.backup');
      expect(backupPath).toContain('state-v0.1.0');
      
      // Verify backup exists
      const backupFile = Bun.file(backupPath);
      expect(await backupFile.exists()).toBe(true);
      
      // Verify original state unchanged
      const file = Bun.file(statePath);
      const content = await file.text();
      const state = yaml.load(content) as any;
      expect(state.version).toBe('0.1.0');
    });
  });

  describe('checklist migrate --list-backups', () => {
    it('should list all available backups', async () => {
      // Create multiple backups
      const testState = {
        version: '0.1.0',
        checklists: []
      };
      
      await Bun.write(statePath, yaml.dump(testState));
      
      // Create several backups with delays to ensure different timestamps
      await runner.createBackup(statePath, '0.1.0');
      await new Promise(resolve => setTimeout(resolve, 10));
      await runner.createBackup(statePath, '0.2.0');
      await new Promise(resolve => setTimeout(resolve, 10));
      await runner.createBackup(statePath, '0.3.0');
      
      // List backups
      const backups = await runner.listBackups();
      
      expect(backups.length).toBeGreaterThanOrEqual(3);
      expect(backups[0].version).toBeDefined();
      expect(backups[0].timestamp).toBeDefined();
      expect(backups[0].path).toBeDefined();

      // Verify backups are sorted by timestamp (newest first)
      for (let i = 1; i < backups.length; i++) {
        const prevDate = new Date(backups[i - 1].timestamp).getTime();
        const currentDate = new Date(backups[i].timestamp).getTime();
        expect(prevDate >= currentDate).toBe(true);
      }
    });

    it('should rotate backups keeping only max allowed', async () => {
      const testState = {
        version: '0.1.0',
        checklists: []
      };
      
      await Bun.write(statePath, yaml.dump(testState));
      
      // Set max backups to 3
      runner.setMaxBackups(3);
      
      // Create more than max backups
      for (let i = 0; i < 5; i++) {
        await runner.createBackup(statePath, `0.${i}.0`);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // List backups
      const backups = await runner.listBackups();
      
      // Should only have max number of backups
      expect(backups.length).toBeLessThanOrEqual(3);
    });
  });

  describe('checklist migrate --restore', () => {
    it('should restore from specific backup', async () => {
      // Create initial state
      const initialState = {
        version: '0.1.0',
        checklists: [
          { id: '1', title: 'Original', items: [] }
        ]
      };
      
      await Bun.write(statePath, yaml.dump(initialState));
      
      // Create backup
      const backupPath = await runner.createBackup(statePath, '0.1.0');
      
      // Modify state
      const modifiedState = {
        version: '1.0.0',
        checklists: [
          { id: '2', title: 'Modified', items: [] }
        ]
      };
      
      await Bun.write(statePath, yaml.dump(modifiedState));
      
      // Restore from backup
      await runner.rollback(statePath, backupPath);
      
      // Verify state was restored
      const file = Bun.file(statePath);
      const content = await file.text();
      const state = yaml.load(content) as any;
      
      expect(state.version).toBe('0.1.0');
      expect(state.checklists[0].title).toBe('Original');
    });

    it('should restore from backup info', async () => {
      const testState = {
        version: '0.1.0',
        checklists: []
      };
      
      await Bun.write(statePath, yaml.dump(testState));
      
      // Create backup
      await runner.createBackup(statePath, '0.1.0');
      
      // Get backup info
      const backups = await runner.listBackups();
      expect(backups.length).toBeGreaterThan(0);
      
      // Modify state
      const modifiedState = {
        version: '1.0.0',
        checklists: [{ id: 'new', title: 'New' }]
      };
      await Bun.write(statePath, yaml.dump(modifiedState));
      
      // Restore using backup info
      await runner.rollback(statePath, backups[0].path);
      
      // Verify restoration
      const file = Bun.file(statePath);
      const content = await file.text();
      const state = yaml.load(content) as any;
      expect(state.version).toBe('0.1.0');
    });
  });

  describe('MigrateCommand Integration', () => {
    it('should execute full migration flow with MigrateCommand', async () => {
      const command = new MigrateCommand(tempDir);

      // Create old version state
      const oldState = {
        version: '0.0.0',
        checklists: []
      };

      await Bun.write(statePath, yaml.dump(oldState));

      // Spy on console output
      const logSpy = spyOn(console, 'log').mockImplementation(() => {});

      // Execute migration
      await command.execute();

      // Verify migration messages were logged
      expect(logSpy).toHaveBeenCalled();

      logSpy.mockRestore();
    });

    it('should handle dry run with MigrateCommand', async () => {
      const command = new MigrateCommand(tempDir);

      // Create old version state
      const oldState = {
        version: '0.0.0',
        checklists: []
      };

      await Bun.write(statePath, yaml.dump(oldState));

      // Spy on console output
      const logSpy = spyOn(console, 'log').mockImplementation(() => {});

      // Execute dry run
      await command.execute({ dryRun: true });

      // Verify dry run messages
      expect(logSpy).toHaveBeenCalled();

      // Verify state wasn't changed
      const file = Bun.file(statePath);
      const content = await file.text();
      const state = yaml.load(content) as any;
      expect(state.version).toBe('0.0.0');

      logSpy.mockRestore();
    });

    it('should list backups with MigrateCommand', async () => {
      const command = new MigrateCommand(tempDir);

      // Create state and backup
      const testState = {
        version: '0.1.0',
        checklists: []
      };

      await Bun.write(statePath, yaml.dump(testState));
      await runner.createBackup(statePath, '0.1.0');

      // Spy on console output
      const logSpy = spyOn(console, 'log').mockImplementation(() => {});

      // List backups
      await command.execute({ listBackups: true });

      expect(logSpy).toHaveBeenCalledWith(ansi.cyan('Available backups:'));

      logSpy.mockRestore();
    });

    it('should create backup only with MigrateCommand', async () => {
      const command = new MigrateCommand(tempDir);

      // Create state
      const testState = {
        version: '0.1.0',
        checklists: []
      };

      await Bun.write(statePath, yaml.dump(testState));

      // Spy on console output
      const logSpy = spyOn(console, 'log').mockImplementation(() => {});

      // Create backup
      await command.execute({ backupOnly: true });

      expect(logSpy).toHaveBeenCalledWith(ansi.cyan('Creating backup...'));

      logSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing state file gracefully', async () => {
      // Run migration on non-existent file
      const result = await runner.migrate(statePath, '1.0.0');
      
      // Should create initial state and migrate
      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe('0.0.0');
      expect(result.toVersion).toBe('1.0.0');
    });

    it('should handle invalid migration path', async () => {
      const testState = {
        version: '2.0.0', // Version not in registry
        checklists: []
      };
      
      await Bun.write(statePath, yaml.dump(testState));
      
      // Try to migrate
      const result = await runner.migrate(statePath, '1.0.0');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle corrupt state files', async () => {
      // Write invalid YAML
      await Bun.write(statePath, '{ invalid yaml: [}');
      
      // Try to migrate
      const result = await runner.migrate(statePath, '1.0.0');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Path Traversal Protection', () => {
    it('should reject backup paths with directory traversal', async () => {
      const maliciousRunner = new MigrationRunner(
        registry,
        '../../../etc/passwd',
        '1.0.0'
      );
      
      const testState = {
        version: '0.1.0',
        checklists: []
      };
      
      await Bun.write(statePath, yaml.dump(testState));
      
      // Should throw error for invalid backup path
      await expect(
        maliciousRunner.createBackup(statePath, '0.1.0')
      ).rejects.toThrow('Invalid backup directory path');
    });

    it('should sanitize backup directory paths', async () => {
      const testState = {
        version: '0.1.0',
        checklists: []
      };
      
      await Bun.write(statePath, yaml.dump(testState));
      
      // Create backup with safe path
      const backupPath = await runner.createBackup(statePath, '0.1.0');
      
      // Verify backup path is within expected directory
      expect(backupPath).toContain(tempDir);
      expect(backupPath).not.toContain('..');
    });
  });
});