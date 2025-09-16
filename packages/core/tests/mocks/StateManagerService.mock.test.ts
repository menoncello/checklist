import { beforeEach, describe, expect, test } from 'bun:test';
import { MockStateManagerService } from './StateManagerService.mock';
import type { StateData, WorkflowInstance } from '../../src/interfaces/IStateManager';

describe('MockStateManagerService', () => {
  let mockStateManager: MockStateManagerService;
  let defaultState: StateData;

  beforeEach(() => {
    mockStateManager = new MockStateManagerService();
    defaultState = {
      version: '1.0.0',
      instances: [],
      config: {},
    };
  });

  describe('constructor', () => {
    test('should initialize with default state', () => {
      const state = mockStateManager.getState();
      expect(state).toEqual(defaultState);
    });

    test('should initialize with default working directory', () => {
      expect(mockStateManager.getWorkingDirectory()).toBe('.checklist-test');
    });

    test('should not be locked initially', () => {
      expect(mockStateManager.isLocked()).toBe(false);
    });

    test('should have empty call history', () => {
      expect(mockStateManager.getCallCount('initialize')).toBe(0);
      expect(mockStateManager.wasCalled('initialize')).toBe(false);
    });
  });

  describe('initialize', () => {
    test('should initialize successfully with default directory', async () => {
      await mockStateManager.initialize();

      expect(mockStateManager.wasCalled('initialize')).toBe(true);
      expect(mockStateManager.getCallCount('initialize')).toBe(1);
    });

    test('should initialize with custom working directory', async () => {
      const customDir = '/custom/path';
      await mockStateManager.initialize(customDir);

      expect(mockStateManager.getWorkingDirectory()).toBe(customDir);
      expect(mockStateManager.wasCalled('initialize')).toBe(true);
    });

    test('should not change directory for empty string', async () => {
      const originalDir = mockStateManager.getWorkingDirectory();
      await mockStateManager.initialize('');

      expect(mockStateManager.getWorkingDirectory()).toBe(originalDir);
    });

    test('should not change directory for undefined', async () => {
      const originalDir = mockStateManager.getWorkingDirectory();
      await mockStateManager.initialize(undefined);

      expect(mockStateManager.getWorkingDirectory()).toBe(originalDir);
    });

    test('should fail when configured to fail', async () => {
      mockStateManager.failNextCall('initialize');

      await expect(mockStateManager.initialize()).rejects.toThrow('Mock error: initialize failed');
      expect(mockStateManager.wasCalled('initialize')).toBe(true);
    });
  });

  describe('load', () => {
    test('should load default state', async () => {
      const loadedState = await mockStateManager.load();

      expect(loadedState).toEqual(defaultState);
      expect(mockStateManager.wasCalled('load')).toBe(true);
      expect(mockStateManager.loadCallHistory).toHaveLength(1);
    });

    test('should return copy of state, not reference', async () => {
      const state1 = await mockStateManager.load();
      const state2 = await mockStateManager.load();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Different objects
    });

    test('should track load history', async () => {
      const beforeTime = new Date();
      await mockStateManager.load();
      await mockStateManager.load();
      const afterTime = new Date();

      expect(mockStateManager.loadCallHistory).toHaveLength(2);
      expect(mockStateManager.loadCallHistory[0].getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(mockStateManager.loadCallHistory[1].getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    test('should fail when configured to fail', async () => {
      mockStateManager.failNextCall('load');

      await expect(mockStateManager.load()).rejects.toThrow('Mock error: load failed');
      expect(mockStateManager.wasCalled('load')).toBe(true);
    });
  });

  describe('save', () => {
    test('should save state successfully', async () => {
      const newState: StateData = {
        version: '2.0.0',
        instances: [mockStateManager.createTestInstance()],
        config: { test: true },
      };

      await mockStateManager.save(newState);

      expect(mockStateManager.getState()).toEqual(newState);
      expect(mockStateManager.wasCalled('save')).toBe(true);
      expect(mockStateManager.saveCallHistory).toHaveLength(1);
      expect(mockStateManager.saveCallHistory[0]).toEqual(newState);
    });

    test('should save copy of state, not reference', async () => {
      const newState: StateData = {
        version: '2.0.0',
        instances: [],
        config: {},
      };

      await mockStateManager.save(newState);
      newState.version = '3.0.0'; // Modify original

      expect(mockStateManager.getState().version).toBe('2.0.0'); // Should not be affected
    });

    test('should track save history', async () => {
      const state1: StateData = { ...defaultState, version: '1.1.0' };
      const state2: StateData = { ...defaultState, version: '1.2.0' };

      await mockStateManager.save(state1);
      await mockStateManager.save(state2);

      expect(mockStateManager.saveCallHistory).toHaveLength(2);
      expect(mockStateManager.saveCallHistory[0]).toEqual(state1);
      expect(mockStateManager.saveCallHistory[1]).toEqual(state2);
    });

    test('should fail when configured to fail', async () => {
      mockStateManager.failNextCall('save');

      await expect(mockStateManager.save(defaultState)).rejects.toThrow('Mock error: save failed');
      expect(mockStateManager.wasCalled('save')).toBe(true);
    });
  });

  describe('backup', () => {
    test('should create backup successfully', async () => {
      const backupId = await mockStateManager.backup();

      expect(backupId).toMatch(/^backup-\d+$/);
      expect(mockStateManager.wasCalled('backup')).toBe(true);
    });

    test('should create multiple unique backups', async () => {
      const backup1 = await mockStateManager.backup();
      await new Promise(resolve => setTimeout(resolve, 1)); // Ensure different timestamps
      const backup2 = await mockStateManager.backup();

      expect(backup1).not.toBe(backup2);
      expect(backup1).toMatch(/^backup-\d+$/);
      expect(backup2).toMatch(/^backup-\d+$/);
    });

    test('should backup current state', async () => {
      const testState: StateData = {
        version: '2.0.0',
        instances: [mockStateManager.createTestInstance()],
        config: { test: true },
      };

      mockStateManager.setState(testState);
      const backupId = await mockStateManager.backup();

      // Verify backup by restoring it
      mockStateManager.setState(defaultState); // Change state
      await mockStateManager.restore(backupId);
      expect(mockStateManager.getState()).toEqual(testState);
    });

    test('should fail when configured to fail', async () => {
      mockStateManager.failNextCall('backup');

      await expect(mockStateManager.backup()).rejects.toThrow('Mock error: backup failed');
      expect(mockStateManager.wasCalled('backup')).toBe(true);
    });
  });

  describe('restore', () => {
    test('should restore from backup successfully', async () => {
      const originalState: StateData = {
        version: '2.0.0',
        instances: [mockStateManager.createTestInstance()],
        config: { test: true },
      };

      mockStateManager.setState(originalState);
      const backupId = await mockStateManager.backup();

      // Change state
      mockStateManager.setState(defaultState);
      expect(mockStateManager.getState()).toEqual(defaultState);

      // Restore from backup
      await mockStateManager.restore(backupId);
      expect(mockStateManager.getState()).toEqual(originalState);
      expect(mockStateManager.wasCalled('restore')).toBe(true);
    });

    test('should fail for non-existent backup', async () => {
      await expect(mockStateManager.restore('nonexistent-backup')).rejects.toThrow('Backup not found: nonexistent-backup');
      expect(mockStateManager.wasCalled('restore')).toBe(true);
    });

    test('should restore copy of backup, not reference', async () => {
      const originalState: StateData = {
        version: '2.0.0',
        instances: [],
        config: { test: true },
      };

      mockStateManager.setState(originalState);
      const backupId = await mockStateManager.backup();

      await mockStateManager.restore(backupId);
      const restoredState = mockStateManager.getState();
      restoredState.version = '3.0.0'; // Modify restored state

      // Backup another restore to verify original backup wasn't affected
      await mockStateManager.restore(backupId);
      expect(mockStateManager.getState().version).toBe('2.0.0');
    });

    test('should fail when configured to fail', async () => {
      const backupId = await mockStateManager.backup();
      mockStateManager.failNextCall('restore');

      await expect(mockStateManager.restore(backupId)).rejects.toThrow('Mock error: restore failed');
      expect(mockStateManager.wasCalled('restore')).toBe(true);
    });
  });

  describe('validate', () => {
    test('should validate correct state', () => {
      const validState: StateData = {
        version: '1.0.0',
        instances: [],
        config: {},
      };

      const result = mockStateManager.validate(validState);

      expect(result).toBe(true);
      expect(mockStateManager.wasCalled('validate')).toBe(true);
    });

    test('should validate state with instances', () => {
      const validState: StateData = {
        version: '1.0.0',
        instances: [mockStateManager.createTestInstance()],
        config: { test: true },
      };

      const result = mockStateManager.validate(validState);

      expect(result).toBe(true);
    });

    test('should reject null state', () => {
      const result = mockStateManager.validate(null as any);

      expect(result).toBe(false);
    });

    test('should reject non-object state', () => {
      const result = mockStateManager.validate('invalid' as any);

      expect(result).toBe(false);
    });

    test('should reject state without version', () => {
      const invalidState = {
        instances: [],
        config: {},
      } as any;

      const result = mockStateManager.validate(invalidState);

      expect(result).toBe(false);
    });

    test('should reject state without instances', () => {
      const invalidState = {
        version: '1.0.0',
        config: {},
      } as any;

      const result = mockStateManager.validate(invalidState);

      expect(result).toBe(false);
    });

    test('should fail when configured to fail', () => {
      mockStateManager.failNextCall('validate');

      const result = mockStateManager.validate(defaultState);

      expect(result).toBe(false);
      expect(mockStateManager.wasCalled('validate')).toBe(true);
    });
  });

  describe('reset', () => {
    test('should reset to default state', async () => {
      // Change state first
      const modifiedState: StateData = {
        version: '2.0.0',
        instances: [mockStateManager.createTestInstance()],
        config: { test: true },
      };
      mockStateManager.setState(modifiedState);

      await mockStateManager.reset();

      expect(mockStateManager.getState()).toEqual(defaultState);
      expect(mockStateManager.wasCalled('reset')).toBe(true);
    });

    test('should fail when configured to fail', async () => {
      mockStateManager.failNextCall('reset');

      await expect(mockStateManager.reset()).rejects.toThrow('Mock error: reset failed');
      expect(mockStateManager.wasCalled('reset')).toBe(true);
    });
  });

  describe('getWorkingDirectory', () => {
    test('should return working directory', () => {
      const dir = mockStateManager.getWorkingDirectory();

      expect(dir).toBe('.checklist-test');
      expect(mockStateManager.wasCalled('getWorkingDirectory')).toBe(true);
    });

    test('should return updated directory after initialization', async () => {
      await mockStateManager.initialize('/new/path');
      const dir = mockStateManager.getWorkingDirectory();

      expect(dir).toBe('/new/path');
    });
  });

  describe('exists', () => {
    test('should always return true', async () => {
      const result = await mockStateManager.exists();

      expect(result).toBe(true);
      expect(mockStateManager.wasCalled('exists')).toBe(true);
    });
  });

  describe('lock/unlock', () => {
    test('should lock successfully', async () => {
      expect(mockStateManager.isLocked()).toBe(false);

      await mockStateManager.lock();

      expect(mockStateManager.isLocked()).toBe(true);
      expect(mockStateManager.wasCalled('lock')).toBe(true);
    });

    test('should unlock successfully', async () => {
      await mockStateManager.lock();
      expect(mockStateManager.isLocked()).toBe(true);

      await mockStateManager.unlock();

      expect(mockStateManager.isLocked()).toBe(false);
      expect(mockStateManager.wasCalled('unlock')).toBe(true);
    });

    test('should fail to lock when already locked', async () => {
      await mockStateManager.lock();

      await expect(mockStateManager.lock()).rejects.toThrow('State is already locked');
      expect(mockStateManager.getCallCount('lock')).toBe(2);
    });

    test('should handle unlock when not locked', async () => {
      expect(mockStateManager.isLocked()).toBe(false);

      await mockStateManager.unlock(); // Should not throw

      expect(mockStateManager.isLocked()).toBe(false);
      expect(mockStateManager.wasCalled('unlock')).toBe(true);
    });

    test('should fail lock when configured to fail', async () => {
      mockStateManager.failNextCall('lock');

      await expect(mockStateManager.lock()).rejects.toThrow('Mock error: lock failed');
      expect(mockStateManager.wasCalled('lock')).toBe(true);
      expect(mockStateManager.isLocked()).toBe(false); // Should remain unlocked
    });

    test('should fail unlock when configured to fail', async () => {
      await mockStateManager.lock();
      mockStateManager.failNextCall('unlock');

      await expect(mockStateManager.unlock()).rejects.toThrow('Mock error: unlock failed');
      expect(mockStateManager.wasCalled('unlock')).toBe(true);
    });
  });

  describe('test utilities', () => {
    test('setState should update internal state', () => {
      const newState: StateData = {
        version: '2.0.0',
        instances: [mockStateManager.createTestInstance()],
        config: { test: true },
      };

      mockStateManager.setState(newState);

      expect(mockStateManager.getState()).toEqual(newState);
    });

    test('getState should return copy of state', () => {
      const state1 = mockStateManager.getState();
      const state2 = mockStateManager.getState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Different objects
    });

    test('failNextCall should configure next method to fail', async () => {
      mockStateManager.failNextCall('load');

      await expect(mockStateManager.load()).rejects.toThrow('Mock error: load failed');

      // Should not fail on subsequent calls
      await expect(mockStateManager.load()).resolves.toBeDefined();
    });

    test('clearHistory should reset all tracking data', async () => {
      // Generate some history
      await mockStateManager.initialize();
      await mockStateManager.load();
      await mockStateManager.save(defaultState);
      await mockStateManager.backup();

      expect(mockStateManager.wasCalled('initialize')).toBe(true);
      expect(mockStateManager.saveCallHistory).toHaveLength(1);
      expect(mockStateManager.loadCallHistory).toHaveLength(1);

      mockStateManager.clearHistory();

      expect(mockStateManager.wasCalled('initialize')).toBe(false);
      expect(mockStateManager.getCallCount('initialize')).toBe(0);
      expect(mockStateManager.saveCallHistory).toHaveLength(0);
      expect(mockStateManager.loadCallHistory).toHaveLength(0);
    });

    test('getCallCount should return correct count', async () => {
      expect(mockStateManager.getCallCount('load')).toBe(0);

      await mockStateManager.load();
      expect(mockStateManager.getCallCount('load')).toBe(1);

      await mockStateManager.load();
      expect(mockStateManager.getCallCount('load')).toBe(2);
    });

    test('wasCalled should return correct boolean', async () => {
      expect(mockStateManager.wasCalled('save')).toBe(false);

      await mockStateManager.save(defaultState);

      expect(mockStateManager.wasCalled('save')).toBe(true);
    });

    test('createTestInstance should return valid workflow instance', () => {
      const instance = mockStateManager.createTestInstance();

      expect(instance).toEqual({
        id: 'test-instance',
        workflowId: 'test-workflow',
        currentStepId: 'step-1',
        startedAt: expect.any(Date),
        updatedAt: expect.any(Date),
        status: 'active',
        stepStates: {
          'step-1': {
            stepId: 'step-1',
            status: 'pending',
          },
        },
      });
    });

    test('createTestInstance should accept custom id', () => {
      const customId = 'custom-instance-id';
      const instance = mockStateManager.createTestInstance(customId);

      expect(instance.id).toBe(customId);
    });

    test('createTestInstance should create new instances each time', () => {
      const instance1 = mockStateManager.createTestInstance();
      const instance2 = mockStateManager.createTestInstance();

      expect(instance1).not.toBe(instance2); // Different objects
      expect(instance1.startedAt).not.toBe(instance2.startedAt); // Different dates
    });
  });

  describe('edge cases', () => {
    test('should handle multiple failures configured', async () => {
      mockStateManager.failNextCall('load');
      mockStateManager.failNextCall('save'); // Should override

      // First call should succeed (load failure was overridden)
      await expect(mockStateManager.load()).resolves.toBeDefined();

      // Second call should fail (save failure)
      await expect(mockStateManager.save(defaultState)).rejects.toThrow('Mock error: save failed');

      // Third call should succeed (failure was cleared)
      await expect(mockStateManager.save(defaultState)).resolves.toBeUndefined();
    });

    test('should handle state with complex instances', async () => {
      const complexInstance: WorkflowInstance = {
        id: 'complex-instance',
        workflowId: 'complex-workflow',
        currentStepId: 'step-2',
        startedAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
        completedAt: new Date('2023-01-03'),
        status: 'completed',
        stepStates: {
          'step-1': {
            stepId: 'step-1',
            status: 'completed',
            completedAt: new Date('2023-01-01'),
            notes: 'Test step 1',
            metadata: { priority: 'high' },
          },
          'step-2': {
            stepId: 'step-2',
            status: 'completed',
            completedAt: new Date('2023-01-02'),
            notes: 'Test step 2',
          },
        },
        metadata: { source: 'test', environment: 'development' },
      };

      const complexState: StateData = {
        version: '1.5.0',
        activeInstance: complexInstance,
        instances: [complexInstance],
        config: { debug: true, timeout: 5000 },
      };

      await mockStateManager.save(complexState);
      const loadedState = await mockStateManager.load();

      expect(loadedState).toEqual(complexState);
      expect(mockStateManager.validate(loadedState)).toBe(true);
    });

    test('should handle empty and undefined values gracefully', () => {
      mockStateManager.setState({
        version: '',
        instances: [],
        config: undefined,
      } as any);

      const state = mockStateManager.getState();
      expect(state.version).toBe('');
      expect(state.config).toBeUndefined();
    });

    test('should create multiple independent backups', async () => {
      // Create a new instance to avoid beforeEach clearHistory interference
      const testStateManager = new MockStateManagerService();

      const state1: StateData = { ...defaultState, version: '1.5.0' };
      const state2: StateData = { ...defaultState, version: '2.0.0' };

      testStateManager.setState(state1);
      const backup1 = await testStateManager.backup();

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));

      testStateManager.setState(state2);
      const backup2 = await testStateManager.backup();

      // Verify different backup IDs were created
      expect(backup1).not.toBe(backup2);
      expect(backup1).toMatch(/^backup-\d+$/);
      expect(backup2).toMatch(/^backup-\d+$/);

      // Verify we can restore the latest backup
      await testStateManager.restore(backup2);
      expect(testStateManager.getState().version).toBe('2.0.0');
    });
  });
});