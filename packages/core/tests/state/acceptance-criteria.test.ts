import { beforeEach, describe, expect, test, afterEach } from 'bun:test';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import { StateManager } from '../../src/state/StateManager';
import { DirectoryManager } from '../../src/state/DirectoryManager';
import { BackupManager } from '../../src/state/BackupManager';
import { ConcurrencyManager } from '../../src/state/ConcurrencyManager';
import type { ChecklistState } from '../../src/state/types';

describe('Story 1.5 - State Management Acceptance Criteria', () => {
  const testDir = '.test-checklist-ac';
  let stateManager: StateManager;

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    stateManager = new StateManager(testDir);
  });

  afterEach(async () => {
    await stateManager.cleanup();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('AC1: State manager creates .checklist/ directory structure automatically', async () => {
    await stateManager.initializeState();
    
    expect(existsSync(testDir)).toBe(true);
    expect(existsSync(join(testDir, 'backups'))).toBe(true);
    expect(existsSync(join(testDir, '.locks'))).toBe(true);
    expect(existsSync(join(testDir, '.cache'))).toBe(true);
    expect(existsSync(join(testDir, 'logs'))).toBe(true);
  });

  test('AC2: YAML state files with proper schema', async () => {
    await stateManager.initializeState();
    
    const stateFile = Bun.file(join(testDir, 'state.yaml'));
    expect(await stateFile.exists()).toBe(true);
    
    const content = await stateFile.text();
    const state = yaml.load(content) as ChecklistState;
    
    expect(state.schemaVersion).toBeDefined();
    expect(state.checksum).toBeDefined();
    expect(state.completedSteps).toBeArray();
    expect(state.recovery).toBeDefined();
    expect(state.conflicts).toBeDefined();
  });

  test('AC3: Atomic writes using temp file + rename strategy', async () => {
    const state = await stateManager.initializeState();
    
    state.completedSteps.push({
      stepId: 'test-step',
      completedAt: new Date().toISOString(),
      executionTime: 100,
      result: 'success',
      commandResults: []
    });
    
    await stateManager.saveState(state);
    
    const loadedState = await stateManager.loadState();
    expect(loadedState.completedSteps).toHaveLength(1);
    expect(loadedState.completedSteps[0].stepId).toBe('test-step');
  });

  test('AC4: Automatic backup before modifications', async () => {
    const state = await stateManager.initializeState();
    const backupDir = join(testDir, 'backups');
    
    const backupsBefore = Bun.file(join(backupDir, 'manifest.yaml'));
    expect(await backupsBefore.exists()).toBe(true);
    
    state.completedSteps.push({
      stepId: 'backup-test',
      completedAt: new Date().toISOString(),
      executionTime: 50,
      result: 'success',
      commandResults: []
    });
    
    await stateManager.saveState(state);
    
    const manifestContent = await backupsBefore.text();
    const manifest = yaml.load(manifestContent) as any;
    expect(manifest.backups.length).toBeGreaterThan(0);
  });

  test('AC5: State corruption detection using checksums', async () => {
    const state = await stateManager.initializeState();
    
    // Create a backup first so recovery can work
    await stateManager.saveState(state);
    
    const statePath = join(testDir, 'state.yaml');
    const stateFile = Bun.file(statePath);
    let content = await stateFile.text();
    const corrupted = content.replace(/checksum: .*/, 'checksum: "invalid-checksum"');
    await Bun.write(statePath, corrupted);
    
    const loadedState = await stateManager.loadState();
    expect(loadedState).toBeDefined();
    // Should recover from backup or reset
    expect(loadedState.recovery?.dataLoss).toBeDefined();
  }, 10000);

  test('AC6: JSON Schema validation ensures integrity', async () => {
    const state = await stateManager.initializeState();
    
    // Create a backup first
    await stateManager.saveState(state);
    
    const statePath = join(testDir, 'state.yaml');
    const invalidState = {
      schemaVersion: '1.0.0',
      invalidField: 'this should not be here'
    };
    
    await Bun.write(statePath, yaml.dump(invalidState));
    
    const loadedState = await stateManager.loadState();
    expect(loadedState).toBeDefined();
    expect(loadedState.checksum).toBeDefined();
  }, 10000);

  test('AC7: File locking prevents concurrent modification', async () => {
    const manager1 = new StateManager(testDir);
    const manager2 = new StateManager(testDir);
    
    await manager1.initializeState();
    
    let completed = 0;
    const promise1 = manager1.updateState(state => {
      state.completedSteps.push({
        stepId: 'concurrent-1',
        completedAt: new Date().toISOString(),
        executionTime: 30,
        result: 'success',
        commandResults: []
      });
      completed++;
      return state;
    });
    
    const promise2 = manager2.updateState(state => {
      state.completedSteps.push({
        stepId: 'concurrent-2',
        completedAt: new Date().toISOString(),
        executionTime: 25,
        result: 'success',
        commandResults: []
      });
      completed++;
      return state;
    });
    
    await Promise.all([promise1, promise2]);
    
    const finalState = await manager1.loadState();
    expect(finalState.completedSteps).toHaveLength(2);
    expect(completed).toBe(2);
    
    await manager1.cleanup();
    await manager2.cleanup();
  });

  test('AC8: Migration system for state file version updates', async () => {
    const state = await stateManager.initializeState();
    
    // Create a backup first
    await stateManager.saveState(state);
    
    const statePath = join(testDir, 'state.yaml');
    const oldVersionState = {
      schemaVersion: '0.9.0',
      checksum: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      completedSteps: [],
      recovery: { dataLoss: false },
      conflicts: {}
    };
    
    await Bun.write(statePath, yaml.dump(oldVersionState));
    
    const migratedState = await stateManager.loadState();
    // Migration should update to current version
    expect(migratedState.schemaVersion).toBe('1.0.0');
    // Checksum should be recalculated
    expect(migratedState.checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(migratedState.checksum).not.toBe('sha256:0000000000000000000000000000000000000000000000000000000000000000');
  }, 10000);

  test('AC9: All operations complete in <50ms', async () => {
    const operations = [
      { name: 'initializeState', fn: () => stateManager.initializeState() },
      { name: 'loadState', fn: () => stateManager.loadState() },
      { name: 'saveState', fn: () => stateManager.saveState(stateManager.getCurrentState()!) },
      { name: 'updateState', fn: () => stateManager.updateState(s => s) }
    ];
    
    await stateManager.initializeState();
    
    for (const op of operations) {
      const start = performance.now();
      await op.fn();
      const duration = performance.now() - start;
      
      console.log(`${op.name}: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(50);
    }
  });

  test('Integration: Full workflow with all features', async () => {
    const start = performance.now();
    
    const initialState = await stateManager.initializeState();
    expect(initialState).toBeDefined();
    
    const updatedState = await stateManager.updateState(state => {
      state.activeInstance = {
        id: crypto.randomUUID(),
        templateId: 'test-template',
        templateVersion: '1.0.0',
        projectPath: '/test/path',
        status: 'active',
        currentStepId: 'step-1',
        startedAt: new Date().toISOString(),
        lastModifiedAt: new Date().toISOString()
      };
      return state;
    });
    
    expect(updatedState.activeInstance).toBeDefined();
    expect(updatedState.activeInstance?.templateId).toBe('test-template');
    
    const reloadedState = await stateManager.loadState();
    expect(reloadedState.activeInstance?.templateId).toBe('test-template');
    
    const exportedYaml = await stateManager.exportState();
    expect(exportedYaml).toContain('test-template');
    
    // Test state persistence
    const finalState = await stateManager.loadState();
    expect(finalState.activeInstance?.templateId).toBe('test-template');
    expect(finalState.completedSteps).toEqual(initialState.completedSteps);
    
    const totalTime = performance.now() - start;
    console.log(`Total integration test time: ${totalTime.toFixed(2)}ms`);
    expect(totalTime).toBeLessThan(500);
  }, 15000);
});