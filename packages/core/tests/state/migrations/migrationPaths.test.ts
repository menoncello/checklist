import { describe, it, expect, beforeEach } from 'bun:test';
import { MigrationRegistry } from '../../../src/state/migrations/MigrationRegistry';
import { MigrationRunner } from '../../../src/state/migrations/MigrationRunner';
import { migrations } from '../../../src/state/migrations/scripts';
import * as path from 'path';
import * as yaml from 'js-yaml';

describe('Migration Paths', () => {
  let registry: MigrationRegistry;
  let runner: MigrationRunner;
  // Use unique directory for each test run to avoid conflicts
  const testDir = `/tmp/test-migration-paths-${process.pid}-${Date.now()}`;
  const statePath = path.join(testDir, 'state.yaml');

  beforeEach(async () => {
    registry = new MigrationRegistry();
    migrations.forEach(m => registry.registerMigration(m));
    runner = new MigrationRunner(registry, path.join(testDir, '.backup'));
    
    // Ensure directory exists
    const { mkdir } = await import('fs/promises');
    await mkdir(testDir, { recursive: true });
    await mkdir(path.join(testDir, '.backup'), { recursive: true });
    
    await Bun.write(path.join(testDir, '.gitkeep'), '');
  });

  describe('Full migration path v0.0.0 → v1.0.0', () => {
    it('should migrate through all versions successfully', async () => {
      const initialState = {
        version: '0.0.0',
        checklists: [
          {
            id: 'checklist-1',
            name: 'Test Checklist',
            steps: ['step1', 'step2']
          }
        ],
        activeInstance: {
          checklistId: 'checklist-1',
          completedSteps: ['step1'],
          currentStepId: 'step2'
        }
      };
      
      await Bun.write(statePath, yaml.dump(initialState));

      const result = await runner.migrate(statePath, '1.0.0', { verbose: true });

      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe('0.0.0');
      expect(result.toVersion).toBe('1.0.0');
      expect(result.appliedMigrations).toHaveLength(3);

      const file = Bun.file(statePath);
      const content = await file.text();
      const finalState = yaml.load(content) as any;

      expect(finalState.version).toBe('1.0.0');
      expect(finalState.schemaVersion).toBe('1.0.0');
      
      expect(finalState.metadata).toBeDefined();
      expect(finalState.metadata.created).toBeDefined();
      expect(finalState.metadata.modified).toBeDefined();
      
      expect(finalState.templates).toEqual([]);
      expect(finalState.variables).toEqual({});
      
      expect(finalState.recovery).toEqual({ enabled: false, checkpoints: [] });
      expect(finalState.conflicts).toEqual([]);
      
      // Checksums are added by StateManager, not migrations
      
      expect(finalState.checklists).toHaveLength(1);
      expect(finalState.checklists[0].id).toBe('checklist-1');
      expect(finalState.checklists[0]).toHaveProperty('commandResults');
    });

    it('should handle partial migration v0.1.0 → v1.0.0', async () => {
      const partialState = {
        version: '0.1.0',
        schemaVersion: '0.1.0',
        metadata: {
          created: '2024-01-01T00:00:00Z',
          modified: '2024-01-01T00:00:00Z'
        },
        checklists: [],
        settings: {}
      };
      
      await Bun.write(statePath, yaml.dump(partialState));

      const result = await runner.migrate(statePath, '1.0.0');

      expect(result.success).toBe(true);
      expect(result.fromVersion).toBe('0.1.0');
      expect(result.toVersion).toBe('1.0.0');
      expect(result.appliedMigrations).toHaveLength(2);

      const file = Bun.file(statePath);
      const content = await file.text();
      const finalState = yaml.load(content) as any;

      expect(finalState.version).toBe('1.0.0');
      expect(finalState.templates).toEqual([]);
      expect(finalState.variables).toEqual({});
      expect(finalState.recovery).toEqual({ enabled: false, checkpoints: [] });
      expect(finalState.conflicts).toEqual([]);
    });

    it('should skip migration for already up-to-date state', async () => {
      const upToDateState = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        metadata: { created: '2024-01-01', modified: '2024-01-01' },
        templates: [],
        variables: {},
        recovery: null,
        conflicts: [],
        checksum: 'sha256:abc123'
      };
      
      await Bun.write(statePath, yaml.dump(upToDateState));

      const result = await runner.migrate(statePath, '1.0.0');

      expect(result.success).toBe(true);
      expect(result.appliedMigrations).toHaveLength(0);
    });
  });

  describe('Migration with complex data', () => {
    it('should preserve existing data during migration', async () => {
      const complexState = {
        version: '0.0.0',
        checklists: [
          {
            id: 'cl-1',
            name: 'Deploy Checklist',
            steps: [
              { id: 's1', name: 'Build', command: 'npm run build' },
              { id: 's2', name: 'Test', command: 'npm test' },
              { id: 's3', name: 'Deploy', command: 'npm run deploy' }
            ]
          },
          {
            id: 'cl-2',
            name: 'Review Checklist',
            steps: [
              { id: 'r1', name: 'Code Review' },
              { id: 'r2', name: 'QA Testing' }
            ]
          }
        ],
        activeInstance: {
          checklistId: 'cl-1',
          completedSteps: ['s1', 's2'],
          currentStepId: 's3',
          startedAt: '2024-01-01T10:00:00Z'
        },
        customField: 'should-be-preserved',
        settings: {
          theme: 'dark',
          autoSave: true
        }
      };
      
      await Bun.write(statePath, yaml.dump(complexState));

      const result = await runner.migrate(statePath, '1.0.0');

      expect(result.success).toBe(true);

      const file = Bun.file(statePath);
      const content = await file.text();
      const finalState = yaml.load(content) as any;

      expect(finalState.checklists).toHaveLength(2);
      expect(finalState.checklists[0].name).toBe('Deploy Checklist');
      expect(finalState.checklists[1].name).toBe('Review Checklist');
      
      expect(finalState.activeInstance.checklistId).toBe('cl-1');
      expect(finalState.activeInstance.startedAt).toBe('2024-01-01T10:00:00Z');
      expect(finalState.activeInstance.completedSteps).toHaveLength(2);
      
      expect(finalState.customField).toBe('should-be-preserved');
      expect(finalState.settings.theme).toBe('dark');
      expect(finalState.settings.autoSave).toBe(true);
    });
  });

  describe('Performance benchmarks', () => {
    it('should complete migration within 500ms for typical state', async () => {
      const typicalState = {
        version: '0.0.0',
        checklists: Array.from({ length: 10 }, (_, i) => ({
          id: `checklist-${i}`,
          name: `Checklist ${i}`,
          steps: Array.from({ length: 20 }, (_, j) => ({
            id: `step-${i}-${j}`,
            name: `Step ${j}`,
            description: `Description for step ${j}`
          }))
        }))
      };
      
      await Bun.write(statePath, yaml.dump(typicalState));

      const startTime = performance.now();
      const result = await runner.migrate(statePath, '1.0.0');
      const endTime = performance.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(500);
    });

    it('should handle large state files (>1MB)', async () => {
      const largeState = {
        version: '0.0.0',
        checklists: Array.from({ length: 100 }, (_, i) => ({
          id: `checklist-${i}`,
          name: `Checklist ${i}`,
          description: 'x'.repeat(1000),
          steps: Array.from({ length: 50 }, (_, j) => ({
            id: `step-${i}-${j}`,
            name: `Step ${j}`,
            description: 'y'.repeat(500),
            metadata: { index: j, parent: i }
          }))
        }))
      };
      
      await Bun.write(statePath, yaml.dump(largeState));

      const file = Bun.file(statePath);
      const size = (await file.text()).length;
      expect(size).toBeGreaterThan(1024 * 1024);

      const result = await runner.migrate(statePath, '1.0.0');

      expect(result.success).toBe(true);
      
      const migratedFile = Bun.file(statePath);
      const content = await migratedFile.text();
      const finalState = yaml.load(content) as any;
      
      expect(finalState.version).toBe('1.0.0');
      expect(finalState.checklists).toHaveLength(100);
    });
  });

  describe('Version skipping', () => {
    it('should find optimal path when direct migration exists', async () => {
      registry.registerMigration({
        fromVersion: '0.0.0',
        toVersion: '1.0.0',
        description: 'Direct upgrade to v1.0.0',
        up: (state) => ({
          ...(state as Record<string, unknown>),
          version: '1.0.0',
          schemaVersion: '1.0.0',
          metadata: { created: new Date().toISOString(), modified: new Date().toISOString() },
          templates: [],
          variables: {},
          recovery: null,
          conflicts: [],
          checksum: 'sha256:direct'
        }),
        down: (state) => ({ ...(state as Record<string, unknown>), version: '0.0.0' })
      });

      const path = registry.findPath('0.0.0', '1.0.0');
      
      expect(path.migrations).toHaveLength(1);
      expect(path.migrations[0].description).toBe('Direct upgrade to v1.0.0');
    });
  });

  describe('Migration validation', () => {
    it('should validate state after each migration step', async () => {
      const invalidState = {
        version: '0.0.0',
        checklists: 'invalid'
      };
      
      await Bun.write(statePath, yaml.dump(invalidState));

      const result = await runner.migrate(statePath, '0.1.0');

      const file = Bun.file(statePath);
      const content = await file.text();
      const finalState = yaml.load(content) as any;
      
      expect(finalState.checklists).toEqual([]);
      expect(finalState.metadata).toBeDefined();
    });

    it('should rollback if validation fails', async () => {
      const tempRegistry = new MigrationRegistry();
      
      tempRegistry.registerMigration({
        fromVersion: '0.0.0',
        toVersion: '0.1.0',
        description: 'Failing validation',
        up: (state) => ({ ...(state as Record<string, unknown>), version: '0.1.0', invalid: true }),
        down: (state) => state as Record<string, unknown>,
        validate: () => false
      });

      const tempRunner = new MigrationRunner(tempRegistry, path.join(testDir, '.backup'));
      
      const state = { version: '0.0.0', important: 'data' };
      await Bun.write(statePath, yaml.dump(state));

      const result = await tempRunner.migrate(statePath, '0.1.0');

      expect(result.success).toBe(false);
      
      const file = Bun.file(statePath);
      const content = await file.text();
      const finalState = yaml.load(content) as any;
      
      expect(finalState.version).toBe('0.0.0');
      expect(finalState.important).toBe('data');
    });
  });
});