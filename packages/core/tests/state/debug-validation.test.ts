import { beforeEach, describe, expect, test, afterEach } from 'bun:test';
import { existsSync, rmSync } from 'node:fs';
import { StateManager } from '../../src/state/StateManager';
import { StateValidator } from '../../src/state/validation';

describe('Debug Validation Issues', () => {
  const testDir = '.test-debug';
  let stateManager: StateManager;
  let validator: StateValidator;

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    stateManager = new StateManager(testDir);
    validator = new StateValidator();
  });

  afterEach(async () => {
    await stateManager.cleanup();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('validate initial state', async () => {
    const state = await stateManager.initializeState();
    console.log('Initial state:', JSON.stringify(state, null, 2));
    
    try {
      const validated = await validator.validate(state);
      console.log('Validation successful');
      expect(validated).toBeDefined();
    } catch (error) {
      console.error('Validation error:', error);
      throw error;
    }
  });

  test('validate state after modification', async () => {
    const state = await stateManager.initializeState();
    
    // Try to modify and save
    state.completedSteps.push({
      stepId: 'test-step',
      completedAt: new Date().toISOString(),
      executionTime: 100,
      result: 'success',
      commandResults: []
    });
    
    console.log('Modified state before save:', JSON.stringify(state, null, 2));
    
    try {
      // Don't validate the state directly since checksum is stale
      // Let saveState handle the validation
      await stateManager.saveState(state);
      console.log('Save successful');
      
      // Now load and validate
      const reloaded = await stateManager.loadState();
      const validated = await validator.validate(reloaded);
      console.log('Post-save validation successful');
      expect(validated.completedSteps).toHaveLength(1);
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  });
});