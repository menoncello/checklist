import { beforeEach, describe, expect, test, afterEach } from 'bun:test';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import { StateManager } from '../../src/state/StateManager';

describe('Quick State Management Tests', () => {
  const testDir = '.test-quick';
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

  test('AC1-2: Creates directory structure and YAML files', async () => {
    await stateManager.initializeState();
    
    expect(existsSync(testDir)).toBe(true);
    expect(existsSync(join(testDir, 'backups'))).toBe(true);
    expect(existsSync(join(testDir, '.locks'))).toBe(true);
    expect(existsSync(join(testDir, 'state.yaml'))).toBe(true);
  });

  test('AC3-4: Atomic writes with automatic backup', async () => {
    const state = await stateManager.initializeState();
    
    state.completedSteps.push({
      stepId: 'test-step',
      completedAt: new Date().toISOString(),
      executionTime: 10,
      result: 'success',
      commandResults: []
    });
    
    await stateManager.saveState(state);
    
    const loadedState = await stateManager.loadState();
    expect(loadedState.completedSteps).toHaveLength(1);
    
    // Check backup was created
    const manifestFile = Bun.file(join(testDir, 'backups', 'manifest.yaml'));
    expect(await manifestFile.exists()).toBe(true);
  });

  test('AC5-6: Corruption detection and schema validation', async () => {
    const state = await stateManager.initializeState();
    
    // Save a valid state to create backup
    await stateManager.saveState(state);
    
    // Corrupt the state file with invalid checksum
    const statePath = join(testDir, 'state.yaml');
    const content = await Bun.file(statePath).text();
    const corrupted = content.replace(/checksum: sha256:[a-f0-9]{64}/, 'checksum: sha256:invalid');
    await Bun.write(statePath, corrupted);
    
    // Should recover from corruption
    const recovered = await stateManager.loadState();
    expect(recovered).toBeDefined();
    expect(recovered.checksum).toBeDefined();
    expect(recovered.checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test('AC9: Performance - All operations under 50ms', async () => {
    const timings: Record<string, number> = {};
    
    // Initialize
    let start = performance.now();
    await stateManager.initializeState();
    timings.initialize = performance.now() - start;
    
    // Load
    start = performance.now();
    const state = await stateManager.loadState();
    timings.load = performance.now() - start;
    
    // Update and Save
    start = performance.now();
    await stateManager.updateState(s => {
      s.completedSteps.push({
        stepId: 'perf-test',
        completedAt: new Date().toISOString(),
        executionTime: 5,
        result: 'success',
        commandResults: []
      });
      return s;
    });
    timings.update = performance.now() - start;
    
    console.log('Performance timings (ms):', timings);
    
    // All operations should be under 50ms
    Object.entries(timings).forEach(([op, time]) => {
      expect(time).toBeLessThan(50);
    });
  });

  test('Concurrent access with quick timeout', async () => {
    const manager1 = new StateManager(testDir);
    const manager2 = new StateManager(testDir);
    
    await manager1.initializeState();
    
    // First manager acquires lock
    const promise1 = manager1.updateState(state => {
      state.completedSteps.push({
        stepId: 'mgr1',
        completedAt: new Date().toISOString(),
        executionTime: 5,
        result: 'success',
        commandResults: []
      });
      return state;
    });
    
    // Second manager waits for lock
    const promise2 = manager2.updateState(state => {
      state.completedSteps.push({
        stepId: 'mgr2',
        completedAt: new Date().toISOString(),
        executionTime: 5,
        result: 'success',
        commandResults: []
      });
      return state;
    });
    
    // Both should complete successfully
    await Promise.all([promise1, promise2]);
    
    const final = await manager1.loadState();
    expect(final.completedSteps).toHaveLength(2);
    
    await manager1.cleanup();
    await manager2.cleanup();
  }, 15000); // 15 second timeout for concurrent test
});