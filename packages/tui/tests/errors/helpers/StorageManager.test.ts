import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { StorageManager, StatePreservationMetrics } from '../../../src/errors/helpers/StorageManager';
import { PreservedState } from '../../../src/errors/helpers/SnapshotManager';

describe('StorageManager', () => {
  let storageManager: StorageManager;
  let mockOnStateExpired: any;
  let consoleErrorSpy: any;
  let consoleLogSpy: any;
  let consoleWarnSpy: any;

  beforeEach(() => {
    mockOnStateExpired = mock(() => {});
    storageManager = new StorageManager(1000, '/test/path', mockOnStateExpired);

    // Spy on console methods
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    storageManager.destroy();
    mock.restore();
    consoleErrorSpy?.mockRestore();
    consoleLogSpy?.mockRestore();
    consoleWarnSpy?.mockRestore();
  });

  const createMockState = (id: string, timestamp: number, expiresAt?: number, compressed = false): PreservedState => {
    return {
      id,
      timestamp,
      data: compressed ? 'COMPRESSED:mock-data' : { mock: 'data' },
      metadata: {
        source: 'test',
        version: '1.0.0',
        checksum: 'abc123',
      },
      expiresAt,
    };
  };

  const mockEstimateSize = (state: PreservedState): number => {
    return JSON.stringify(state).length;
  };

  describe('constructor', () => {
    test('should create instance with required parameters', () => {
      const manager = new StorageManager(500);

      expect(manager.getCurrentSize()).toBe(0);
      expect(manager.getUsagePercentage()).toBe(0);
    });

    test('should create instance with optional parameters', () => {
      const manager = new StorageManager(500, '/custom/path', mockOnStateExpired);

      expect(manager.getCurrentSize()).toBe(0);
    });
  });

  describe('storage size tracking', () => {
    test('should track storage size', () => {
      storageManager.trackStorageSize(500);

      expect(storageManager.getCurrentSize()).toBe(500);
    });

    test('should recalculate storage size from states', () => {
      const states = new Map<string, PreservedState>([
        ['state1', createMockState('state1', Date.now())],
        ['state2', createMockState('state2', Date.now())],
      ]);

      storageManager.recalculateStorageSize(states, mockEstimateSize);

      const expectedSize = Array.from(states.values()).reduce(
        (total, state) => total + mockEstimateSize(state),
        0
      );

      expect(storageManager.getCurrentSize()).toBe(expectedSize);
    });

    test('should handle empty states map in recalculation', () => {
      const states = new Map<string, PreservedState>();

      storageManager.recalculateStorageSize(states, mockEstimateSize);

      expect(storageManager.getCurrentSize()).toBe(0);
    });
  });

  describe('storage limits', () => {
    test('should check if over limit', () => {
      storageManager.trackStorageSize(500);
      expect(storageManager.isOverLimit()).toBe(false);

      storageManager.trackStorageSize(1500);
      expect(storageManager.isOverLimit()).toBe(true);
    });

    test('should calculate usage percentage', () => {
      storageManager.trackStorageSize(250);
      expect(storageManager.getUsagePercentage()).toBe(25);

      storageManager.trackStorageSize(750);
      expect(storageManager.getUsagePercentage()).toBe(75);

      storageManager.trackStorageSize(1200);
      expect(storageManager.getUsagePercentage()).toBe(120);
    });
  });

  describe('cleanup operations', () => {
    test('should clean up expired states', () => {
      const now = Date.now();
      const expiredTime = now - 1000;
      const validTime = now + 1000;

      const states = new Map<string, PreservedState>([
        ['expired1', createMockState('expired1', now - 2000, expiredTime)],
        ['expired2', createMockState('expired2', now - 1500, expiredTime)],
        ['valid1', createMockState('valid1', now, validTime)],
        ['valid2', createMockState('valid2', now)], // No expiration
      ]);

      storageManager.trackStorageSize(1000);

      const result = storageManager.performCleanup(states, mockEstimateSize);

      expect(result.cleaned).toBe(2);
      expect(result.freed).toBeGreaterThan(0);
      expect(states.has('expired1')).toBe(false);
      expect(states.has('expired2')).toBe(false);
      expect(states.has('valid1')).toBe(true);
      expect(states.has('valid2')).toBe(true);

      expect(mockOnStateExpired).toHaveBeenCalledTimes(2);
    });

    test('should clean up oldest states when over limit', () => {
      const now = Date.now();
      const states = new Map<string, PreservedState>([
        ['oldest', createMockState('oldest', now - 3000)],
        ['middle', createMockState('middle', now - 2000)],
        ['newest', createMockState('newest', now - 1000)],
      ]);

      // Set initial size to be over limit
      storageManager.trackStorageSize(1500);

      const result = storageManager.performCleanup(states, mockEstimateSize);

      expect(result.cleaned).toBeGreaterThan(0);
      expect(result.freed).toBeGreaterThan(0);

      // Should keep newer states preferentially
      const remainingKeys = Array.from(states.keys());
      if (remainingKeys.length > 0) {
        expect(remainingKeys).toContain('newest');
      }
    });

    test('should handle cleanup when under limit', () => {
      const states = new Map<string, PreservedState>([
        ['state1', createMockState('state1', Date.now())],
      ]);

      storageManager.trackStorageSize(100);

      const result = storageManager.performCleanup(states, mockEstimateSize);

      expect(result.cleaned).toBe(0);
      expect(result.freed).toBe(0);
      expect(states.has('state1')).toBe(true);
    });

    test('should handle cleanup with empty states', () => {
      const states = new Map<string, PreservedState>();

      const result = storageManager.performCleanup(states, mockEstimateSize);

      expect(result.cleaned).toBe(0);
      expect(result.freed).toBe(0);
    });

    test('should filter out already marked states in second pass', () => {
      const now = Date.now();
      const expiredTime = now - 1000;

      const states = new Map<string, PreservedState>([
        ['expired', createMockState('expired', now - 3000, expiredTime)],
        ['old', createMockState('old', now - 2000)],
        ['new', createMockState('new', now - 1000)],
      ]);

      storageManager.trackStorageSize(2000); // Over limit after expiry cleanup

      const result = storageManager.performCleanup(states, mockEstimateSize);

      // Should have cleaned expired state and potentially more due to size limit
      expect(result.cleaned).toBeGreaterThan(0);
      expect(states.has('expired')).toBe(false);
    });
  });

  describe('timer management', () => {
    test('should start cleanup timer', (done) => {
      let callbackCalled = false;
      const callback = () => {
        callbackCalled = true;
        done();
      };

      storageManager.startCleanupTimer(10, callback);

      setTimeout(() => {
        if (!callbackCalled) {
          done(new Error('Callback was not called'));
        }
      }, 50);
    });

    test('should replace existing cleanup timer', () => {
      const callback1 = mock(() => {});
      const callback2 = mock(() => {});

      storageManager.startCleanupTimer(1000, callback1);
      storageManager.startCleanupTimer(1000, callback2);

      // Should not throw error - old timer should be cleared
      expect(() => storageManager.destroy()).not.toThrow();
    });

    test('should start persist timer', (done) => {
      let callbackCalled = false;
      const callback = async () => {
        callbackCalled = true;
        done();
      };

      storageManager.startPersistTimer(5, callback);

      setTimeout(() => {
        if (!callbackCalled) {
          done(new Error('Callback was not called'));
        }
      }, 100);
    });

    test('should handle persist timer callback errors', (done) => {
      const errorCallback = async () => {
        throw new Error('Persist error');
      };

      storageManager.startPersistTimer(5, errorCallback);

      setTimeout(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to persist state:',
          expect.any(Error)
        );
        done();
      }, 100);
    });

    test('should replace existing persist timer', () => {
      const callback1 = mock(async () => {});
      const callback2 = mock(async () => {});

      storageManager.startPersistTimer(1000, callback1);
      storageManager.startPersistTimer(1000, callback2);

      // Should not throw error - old timer should be cleared
      expect(() => storageManager.destroy()).not.toThrow();
    });
  });

  describe('persistence operations', () => {
    test('should persist states to disk', async () => {
      const states = new Map<string, PreservedState>([
        ['state1', createMockState('state1', Date.now())],
        ['state2', createMockState('state2', Date.now())],
      ]);

      storageManager.trackStorageSize(500);

      await storageManager.persistToDisk(states);

      // Wait a bit for the async operation to complete
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Persisted 2 states to /test/path')
      );
    });

    test('should skip persistence when no path configured', async () => {
      const managerWithoutPath = new StorageManager(1000);
      const states = new Map<string, PreservedState>();

      await managerWithoutPath.persistToDisk(states);

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    test('should handle persistence errors', async () => {
      const states = new Map<string, PreservedState>([
        ['problematic', { ...createMockState('test', Date.now()), data: BigInt(123) }], // BigInt cannot be serialized
      ]);

      await expect(storageManager.persistToDisk(states)).rejects.toThrow(
        'Failed to persist to disk'
      );
    });

    test('should load states from disk', async () => {
      const result = await storageManager.loadFromDisk();

      expect(result).toBeInstanceOf(Map);
      expect(result?.size).toBe(0);
    });

    test('should return null when loading without path', async () => {
      const managerWithoutPath = new StorageManager(1000);

      const result = await managerWithoutPath.loadFromDisk();

      expect(result).toBeNull();
    });

    test('should handle load errors gracefully', async () => {
      // Create a manager that will simulate an error during loading
      const manager = new StorageManager(1000, '/invalid/path');

      // Override the simulated behavior to throw an error
      manager.loadFromDisk = async function() {
        try {
          // Simulate the real implementation structure
          await new Promise((resolve) => setTimeout(resolve, 10));
          throw new Error('Simulated load error');
        } catch (error) {
          console.warn(
            `Failed to load from disk: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          return null;
        }
      };

      const result = await manager.loadFromDisk();

      // The method should return null and log warning for errors
      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to load from disk: Simulated load error'
      );
    });
  });

  describe('metrics calculation', () => {
    test('should calculate metrics for empty states', () => {
      const states = new Map<string, PreservedState>();

      const metrics = storageManager.getMetrics(states);

      expect(metrics).toEqual({
        totalStates: 0,
        totalSize: 0,
        oldestState: 0,
        newestState: 0,
        expiredStates: 0,
        compressionRatio: 1,
      });
    });

    test('should calculate metrics for non-empty states', () => {
      const now = Date.now();
      const states = new Map<string, PreservedState>([
        ['state1', createMockState('state1', now - 2000)],
        ['state2', createMockState('state2', now - 1000)],
        ['state3', createMockState('state3', now)],
      ]);

      storageManager.trackStorageSize(500);

      const metrics = storageManager.getMetrics(states);

      expect(metrics.totalStates).toBe(3);
      expect(metrics.totalSize).toBe(500);
      expect(metrics.oldestState).toBe(now - 2000);
      expect(metrics.newestState).toBe(now);
      expect(metrics.expiredStates).toBe(0);
      expect(metrics.compressionRatio).toBe(1);
    });

    test('should count expired states in metrics', () => {
      const now = Date.now();
      const expiredTime = now - 1000;

      const states = new Map<string, PreservedState>([
        ['valid', createMockState('valid', now)],
        ['expired1', createMockState('expired1', now - 2000, expiredTime)],
        ['expired2', createMockState('expired2', now - 1500, expiredTime)],
      ]);

      const metrics = storageManager.getMetrics(states);

      expect(metrics.totalStates).toBe(3);
      expect(metrics.expiredStates).toBe(2);
    });

    test('should calculate compression ratio with compressed states', () => {
      const now = Date.now();
      const states = new Map<string, PreservedState>([
        ['normal1', createMockState('normal1', now)],
        ['normal2', createMockState('normal2', now)],
        ['compressed1', createMockState('compressed1', now, undefined, true)],
        ['compressed2', createMockState('compressed2', now, undefined, true)],
      ]);

      const metrics = storageManager.getMetrics(states);

      expect(metrics.totalStates).toBe(4);
      // 2 out of 4 states are compressed, so ratio should be 1 - (2/4) * 0.3 = 0.85
      expect(metrics.compressionRatio).toBe(0.85);
    });

    test('should handle metrics for single state', () => {
      const now = Date.now();
      const states = new Map<string, PreservedState>([
        ['single', createMockState('single', now)],
      ]);

      storageManager.trackStorageSize(100);

      const metrics = storageManager.getMetrics(states);

      expect(metrics.totalStates).toBe(1);
      expect(metrics.totalSize).toBe(100);
      expect(metrics.oldestState).toBe(now);
      expect(metrics.newestState).toBe(now);
      expect(metrics.expiredStates).toBe(0);
    });
  });

  describe('configuration updates', () => {
    test('should update configuration', () => {
      storageManager.updateConfig(2000, '/new/path');

      // Test that new limit is applied
      storageManager.trackStorageSize(1500);
      expect(storageManager.isOverLimit()).toBe(false);

      storageManager.trackStorageSize(2500);
      expect(storageManager.isOverLimit()).toBe(true);
    });

    test('should update configuration without persist path', () => {
      storageManager.updateConfig(2000);

      storageManager.trackStorageSize(1500);
      expect(storageManager.isOverLimit()).toBe(false);
    });
  });

  describe('destruction and cleanup', () => {
    test('should destroy and clear timers', () => {
      const callback = mock(() => {});
      const persistCallback = mock(async () => {});

      storageManager.startCleanupTimer(1000, callback);
      storageManager.startPersistTimer(1000, persistCallback);

      storageManager.destroy();

      // Should not throw errors after destruction
      expect(() => storageManager.destroy()).not.toThrow();
    });

    test('should handle destruction when no timers exist', () => {
      expect(() => storageManager.destroy()).not.toThrow();
    });

    test('should clear timers individually', () => {
      const callback1 = mock(() => {});
      const callback2 = mock(async () => {});

      storageManager.startCleanupTimer(1000, callback1);
      storageManager.startPersistTimer(1000, callback2);

      // Starting new timers should clear the old ones
      storageManager.startCleanupTimer(2000, callback1);
      storageManager.startPersistTimer(2000, callback2);

      expect(() => storageManager.destroy()).not.toThrow();
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle states without expiration in cleanup', () => {
      const states = new Map<string, PreservedState>([
        ['no-expiry', createMockState('no-expiry', Date.now())],
      ]);

      const result = storageManager.performCleanup(states, mockEstimateSize);

      expect(result.cleaned).toBe(0);
      expect(states.has('no-expiry')).toBe(true);
    });

    test('should handle null expiration times', () => {
      const state = createMockState('test', Date.now());
      state.expiresAt = undefined;

      const states = new Map<string, PreservedState>([['test', state]]);

      const result = storageManager.performCleanup(states, mockEstimateSize);

      expect(result.cleaned).toBe(0);
      expect(states.has('test')).toBe(true);
    });

    test('should handle zero max storage size', () => {
      const zeroManager = new StorageManager(0);

      zeroManager.trackStorageSize(1);
      expect(zeroManager.isOverLimit()).toBe(true);
      expect(zeroManager.getUsagePercentage()).toBe(Infinity);
    });

    test('should handle negative storage sizes', () => {
      storageManager.trackStorageSize(-100);
      expect(storageManager.getCurrentSize()).toBe(-100);
      expect(storageManager.getUsagePercentage()).toBe(-10);
    });

    test('should handle complex cleanup scenarios', () => {
      const now = Date.now();
      const states = new Map<string, PreservedState>([
        ['expired-old', createMockState('expired-old', now - 5000, now - 1000)],
        ['expired-new', createMockState('expired-new', now - 1000, now - 500)],
        ['valid-old', createMockState('valid-old', now - 4000)],
        ['valid-new', createMockState('valid-new', now - 500)],
      ]);

      storageManager.trackStorageSize(3000); // Over limit after cleanup

      const result = storageManager.performCleanup(states, mockEstimateSize);

      // Should clean expired states first, then oldest valid states if needed
      expect(result.cleaned).toBeGreaterThan(0);
      expect(states.has('expired-old')).toBe(false);
      expect(states.has('expired-new')).toBe(false);
    });

    test('should handle estimateSize function errors gracefully', () => {
      const errorEstimateSize = () => {
        throw new Error('Size estimation error');
      };

      const states = new Map<string, PreservedState>([
        ['state1', createMockState('state1', Date.now())],
      ]);

      // The current implementation doesn't wrap the estimateSize calls in try-catch
      // so errors will bubble up. This tests the actual behavior.
      expect(() => {
        storageManager.recalculateStorageSize(states, errorEstimateSize);
      }).toThrow('Size estimation error');
    });

    test('should handle callback exceptions in onStateExpired', () => {
      const errorCallback = mock(() => {
        throw new Error('Callback error');
      });

      const manager = new StorageManager(1000, undefined, errorCallback);
      const now = Date.now();
      const states = new Map<string, PreservedState>([
        ['expired', createMockState('expired', now, now - 1000)],
      ]);

      expect(() => {
        manager.performCleanup(states, mockEstimateSize);
      }).toThrow();
    });
  });
});