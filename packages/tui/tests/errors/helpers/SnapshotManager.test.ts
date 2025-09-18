import { beforeEach, describe, expect, test } from 'bun:test';
import {
  SnapshotManager,
  PreservedState,
  StateSnapshot,
} from '../../../src/errors/helpers/SnapshotManager';

describe('SnapshotManager', () => {
  let snapshotManager: SnapshotManager;
  let mockStates: Map<string, PreservedState>;

  beforeEach(() => {
    snapshotManager = new SnapshotManager();
    mockStates = new Map<string, PreservedState>();

    // Add sample states
    mockStates.set('state1', {
      id: 'state1',
      timestamp: Date.now() - 1000,
      data: { value: 'test1' },
      metadata: {
        source: 'test',
        version: '1.0.0',
        checksum: 'abc123',
      },
      expiresAt: Date.now() + 60000,
    });

    mockStates.set('state2', {
      id: 'state2',
      timestamp: Date.now() - 500,
      data: { value: 'test2' },
      metadata: {
        source: 'test',
        version: '1.0.0',
        checksum: 'def456',
      },
      expiresAt: Date.now() + 60000,
    });

    mockStates.set('state3', {
      id: 'state3',
      timestamp: Date.now(),
      data: { value: 'test3' },
      metadata: {
        source: 'test',
        version: '1.0.0',
        checksum: 'ghi789',
      },
      expiresAt: Date.now() + 60000,
    });
  });

  describe('snapshot creation', () => {
    test('should create snapshot with all states', () => {
      const snapshotId = snapshotManager.createSnapshot('full-snapshot', mockStates);

      expect(snapshotId).toBeDefined();
      expect(snapshotId).toMatch(/^snapshot-full-snapshot-\d+$/);

      const snapshots = snapshotManager.getSnapshotNames();
      expect(snapshots).toContain('full-snapshot');
    });

    test('should create snapshot with selective states', () => {
      const selectedKeys = ['state1', 'state3'];
      const snapshotId = snapshotManager.createSnapshot('selective-snapshot', mockStates, selectedKeys);

      expect(snapshotId).toBeDefined();

      const snapshot = snapshotManager.getSnapshot('selective-snapshot');
      expect(snapshot).toBeDefined();
      expect(snapshot!.states.size).toBe(2);
      expect(snapshot!.states.has('state1')).toBe(true);
      expect(snapshot!.states.has('state2')).toBe(false);
      expect(snapshot!.states.has('state3')).toBe(true);
    });

    test('should create snapshot with empty states map', () => {
      const emptyStates = new Map<string, PreservedState>();
      const snapshotId = snapshotManager.createSnapshot('empty-snapshot', emptyStates);

      expect(snapshotId).toBeDefined();

      const snapshot = snapshotManager.getSnapshot('empty-snapshot');
      expect(snapshot).toBeDefined();
      expect(snapshot!.states.size).toBe(0);
      expect(snapshot!.totalSize).toBe(0);
      expect(snapshot!.compressed).toBe(false);
    });

    test('should create snapshot with size estimation', () => {
      const sizeEstimator = (state: PreservedState) => JSON.stringify(state).length;
      const snapshotId = snapshotManager.createSnapshot('sized-snapshot', mockStates, undefined, sizeEstimator);

      expect(snapshotId).toBeDefined();

      const snapshot = snapshotManager.getSnapshot('sized-snapshot');
      expect(snapshot).toBeDefined();
      expect(snapshot!.totalSize).toBeGreaterThan(0);
    });

    test('should set compressed flag for large snapshots', () => {
      const largeSizeEstimator = () => 15000; // > 10KB threshold
      const snapshotId = snapshotManager.createSnapshot('large-snapshot', mockStates, undefined, largeSizeEstimator);

      const snapshot = snapshotManager.getSnapshot('large-snapshot');
      expect(snapshot).toBeDefined();
      expect(snapshot!.compressed).toBe(true);
    });

    test('should handle nonexistent keys in selective snapshot', () => {
      const keys = ['state1', 'nonexistent', 'state2'];
      const snapshotId = snapshotManager.createSnapshot('partial-snapshot', mockStates, keys);

      const snapshot = snapshotManager.getSnapshot('partial-snapshot');
      expect(snapshot).toBeDefined();
      expect(snapshot!.states.size).toBe(2); // Only existing keys
      expect(snapshot!.states.has('state1')).toBe(true);
      expect(snapshot!.states.has('state2')).toBe(true);
      expect(snapshot!.states.has('nonexistent')).toBe(false);
    });

    test('should create deep copies of states', () => {
      const snapshotId = snapshotManager.createSnapshot('copy-test', mockStates);
      const snapshot = snapshotManager.getSnapshot('copy-test');

      // Modify original state
      const originalState = mockStates.get('state1')!;
      originalState.data = { value: 'modified' };

      // Snapshot should have original data
      const snapshotState = snapshot!.states.get('state1')!;
      expect(snapshotState.data).toEqual({ value: 'test1' });
    });
  });

  describe('snapshot restoration', () => {
    test('should restore all states from snapshot', () => {
      // Create snapshot
      snapshotManager.createSnapshot('restore-test', mockStates);

      // Create new target states map
      const targetStates = new Map<string, PreservedState>();

      // Restore
      const restored = snapshotManager.restoreFromSnapshot('restore-test', targetStates);

      expect(restored).toBe(true);
      expect(targetStates.size).toBe(3);
      expect(targetStates.has('state1')).toBe(true);
      expect(targetStates.has('state2')).toBe(true);
      expect(targetStates.has('state3')).toBe(true);
    });

    test('should restore selective states from snapshot', () => {
      // Create snapshot with all states
      snapshotManager.createSnapshot('selective-restore', mockStates);

      // Create target map
      const targetStates = new Map<string, PreservedState>();

      // Restore only specific keys
      const restored = snapshotManager.restoreFromSnapshot('selective-restore', targetStates, ['state1', 'state3']);

      expect(restored).toBe(true);
      expect(targetStates.size).toBe(2);
      expect(targetStates.has('state1')).toBe(true);
      expect(targetStates.has('state2')).toBe(false);
      expect(targetStates.has('state3')).toBe(true);
    });

    test('should handle nonexistent snapshot restoration', () => {
      const targetStates = new Map<string, PreservedState>();
      const restored = snapshotManager.restoreFromSnapshot('nonexistent', targetStates);

      expect(restored).toBe(false);
      expect(targetStates.size).toBe(0);
    });

    test('should handle selective restoration with nonexistent keys', () => {
      snapshotManager.createSnapshot('partial-restore', mockStates);
      const targetStates = new Map<string, PreservedState>();

      const restored = snapshotManager.restoreFromSnapshot('partial-restore', targetStates, ['state1', 'nonexistent', 'state2']);

      expect(restored).toBe(true);
      expect(targetStates.size).toBe(2); // Only existing keys restored
      expect(targetStates.has('state1')).toBe(true);
      expect(targetStates.has('state2')).toBe(true);
      expect(targetStates.has('nonexistent')).toBe(false);
    });

    test('should create deep copies during restoration', () => {
      snapshotManager.createSnapshot('copy-restore', mockStates);
      const targetStates = new Map<string, PreservedState>();

      snapshotManager.restoreFromSnapshot('copy-restore', targetStates);

      // Modify restored state
      const restoredState = targetStates.get('state1')!;
      restoredState.data = { value: 'modified-restored' };

      // Original snapshot should be unchanged
      const snapshot = snapshotManager.getSnapshot('copy-restore');
      const snapshotState = snapshot!.states.get('state1')!;
      expect(snapshotState.data).toEqual({ value: 'test1' });
    });
  });

  describe('snapshot management', () => {
    test('should get snapshot by name', () => {
      snapshotManager.createSnapshot('get-test', mockStates);

      const snapshot = snapshotManager.getSnapshot('get-test');
      expect(snapshot).toBeDefined();
      expect(snapshot!.id).toMatch(/^snapshot-get-test-\d+$/);
      expect(snapshot!.states.size).toBe(3);
      expect(snapshot!.timestamp).toBeGreaterThan(0);
    });

    test('should return null for nonexistent snapshot', () => {
      const snapshot = snapshotManager.getSnapshot('nonexistent');
      expect(snapshot).toBe(null);
    });

    test('should delete snapshots', () => {
      snapshotManager.createSnapshot('delete-test', mockStates);

      expect(snapshotManager.hasSnapshot('delete-test')).toBe(true);

      const deleted = snapshotManager.deleteSnapshot('delete-test');
      expect(deleted).toBe(true);
      expect(snapshotManager.hasSnapshot('delete-test')).toBe(false);
    });

    test('should return false when deleting nonexistent snapshot', () => {
      const deleted = snapshotManager.deleteSnapshot('nonexistent');
      expect(deleted).toBe(false);
    });

    test('should check if snapshot exists', () => {
      expect(snapshotManager.hasSnapshot('exists-test')).toBe(false);

      snapshotManager.createSnapshot('exists-test', mockStates);
      expect(snapshotManager.hasSnapshot('exists-test')).toBe(true);
    });

    test('should get snapshot names', () => {
      snapshotManager.createSnapshot('snapshot1', mockStates);
      snapshotManager.createSnapshot('snapshot2', mockStates);
      snapshotManager.createSnapshot('snapshot3', mockStates);

      const names = snapshotManager.getSnapshotNames();
      expect(names).toContain('snapshot1');
      expect(names).toContain('snapshot2');
      expect(names).toContain('snapshot3');
      expect(names.length).toBe(3);
    });

    test('should clear all snapshots', () => {
      snapshotManager.createSnapshot('clear1', mockStates);
      snapshotManager.createSnapshot('clear2', mockStates);

      expect(snapshotManager.getSnapshotNames().length).toBe(2);

      snapshotManager.clear();
      expect(snapshotManager.getSnapshotNames().length).toBe(0);
    });
  });

  describe('snapshot metrics', () => {
    test('should provide metrics for empty manager', () => {
      const metrics = snapshotManager.getSnapshotMetrics();

      expect(metrics.count).toBe(0);
      expect(metrics.totalStates).toBe(0);
      expect(metrics.totalSize).toBe(0);
      expect(metrics.oldestSnapshot).toBe(0);
      expect(metrics.newestSnapshot).toBe(0);
    });

    test('should provide metrics for snapshots', () => {
      const sizeEstimator = () => 100;

      snapshotManager.createSnapshot('metrics1', mockStates, undefined, sizeEstimator);
      snapshotManager.createSnapshot('metrics2', mockStates, ['state1'], sizeEstimator);

      const metrics = snapshotManager.getSnapshotMetrics();

      expect(metrics.count).toBe(2);
      expect(metrics.totalStates).toBe(4); // 3 + 1
      expect(metrics.totalSize).toBe(400); // 3*100 + 1*100
      expect(metrics.oldestSnapshot).toBeGreaterThan(0);
      expect(metrics.newestSnapshot).toBeGreaterThan(0);
      expect(metrics.newestSnapshot).toBeGreaterThanOrEqual(metrics.oldestSnapshot);
    });
  });

  describe('snapshot pruning', () => {
    test('should prune old snapshots', () => {
      // Create snapshots with different timestamps by manipulating the snapshots directly
      const oldStates = new Map(mockStates);

      // Create first snapshot
      const oldSnapshotId = snapshotManager.createSnapshot('old1', oldStates);

      // Create second snapshot
      const newSnapshotId = snapshotManager.createSnapshot('newer', oldStates);

      // Manually adjust timestamps to simulate age difference
      const snapshots = (snapshotManager as any).snapshots;
      const oldSnapshot = snapshots.get('old1');
      const newSnapshot = snapshots.get('newer');

      if (oldSnapshot && newSnapshot) {
        // Make old snapshot much older
        oldSnapshot.timestamp = Date.now() - 10000; // 10 seconds ago
        newSnapshot.timestamp = Date.now(); // Now
      }

      // Prune snapshots older than 5 seconds
      const pruned = snapshotManager.pruneOldSnapshots(5000);

      expect(pruned).toBe(1); // Should prune 'old1'
      expect(snapshotManager.hasSnapshot('old1')).toBe(false);
      expect(snapshotManager.hasSnapshot('newer')).toBe(true);
    });

    test('should return zero when no snapshots to prune', () => {
      snapshotManager.createSnapshot('recent', mockStates);

      const pruned = snapshotManager.pruneOldSnapshots(60000); // 1 minute
      expect(pruned).toBe(0);
      expect(snapshotManager.hasSnapshot('recent')).toBe(true);
    });

    test('should prune snapshots older than maxAge', () => {
      snapshotManager.createSnapshot('prune1', mockStates);
      snapshotManager.createSnapshot('prune2', mockStates);

      // Use a very small maxAge that will cause snapshots to be considered old
      const pruned = snapshotManager.pruneOldSnapshots(-1); // Negative age means all are old
      expect(pruned).toBe(2);
      expect(snapshotManager.getSnapshotNames().length).toBe(0);
    });
  });

  describe('snapshot import/export', () => {
    test('should export snapshot to JSON', () => {
      snapshotManager.createSnapshot('export-test', mockStates);

      const exported = snapshotManager.exportSnapshot('export-test');
      expect(exported).toBeDefined();
      expect(exported).not.toBe(null);

      const parsed = JSON.parse(exported!);
      expect(parsed).toHaveProperty('id');
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('states');
      expect(parsed).toHaveProperty('totalSize');
      expect(parsed).toHaveProperty('compressed');

      // Check that states were converted from Map to object
      expect(typeof parsed.states).toBe('object');
      expect(parsed.states.state1).toBeDefined();
      expect(parsed.states.state2).toBeDefined();
      expect(parsed.states.state3).toBeDefined();
    });

    test('should return null when exporting nonexistent snapshot', () => {
      const exported = snapshotManager.exportSnapshot('nonexistent');
      expect(exported).toBe(null);
    });

    test('should import snapshot from JSON', () => {
      // First export a snapshot
      snapshotManager.createSnapshot('import-source', mockStates);
      const exported = snapshotManager.exportSnapshot('import-source');

      // Clear and import
      snapshotManager.clear();
      const imported = snapshotManager.importSnapshot('imported-snapshot', exported!);

      expect(imported).toBe(true);
      expect(snapshotManager.hasSnapshot('imported-snapshot')).toBe(true);

      const importedSnapshot = snapshotManager.getSnapshot('imported-snapshot');
      expect(importedSnapshot).toBeDefined();
      expect(importedSnapshot!.states.size).toBe(3);
      expect(importedSnapshot!.states.has('state1')).toBe(true);
      expect(importedSnapshot!.states.has('state2')).toBe(true);
      expect(importedSnapshot!.states.has('state3')).toBe(true);
    });

    test('should handle invalid JSON during import', () => {
      const invalidJson = '{ invalid json }';
      const imported = snapshotManager.importSnapshot('invalid', invalidJson);

      expect(imported).toBe(false);
      expect(snapshotManager.hasSnapshot('invalid')).toBe(false);
    });

    test('should handle malformed snapshot data during import', () => {
      const malformedData = JSON.stringify({ incomplete: 'data' });
      const imported = snapshotManager.importSnapshot('malformed', malformedData);

      expect(imported).toBe(false);
      expect(snapshotManager.hasSnapshot('malformed')).toBe(false);
    });

    test('should preserve snapshot structure during import/export cycle', () => {
      const originalSnapshot = snapshotManager.createSnapshot('round-trip', mockStates);
      const exported = snapshotManager.exportSnapshot('round-trip');

      snapshotManager.clear();
      snapshotManager.importSnapshot('round-trip-imported', exported!);

      const importedSnapshot = snapshotManager.getSnapshot('round-trip-imported');
      expect(importedSnapshot).toBeDefined();
      expect(importedSnapshot!.states.size).toBe(3);

      // Verify data integrity
      const state1 = importedSnapshot!.states.get('state1');
      expect(state1).toBeDefined();
      expect(state1!.data).toEqual({ value: 'test1' });
      expect(state1!.metadata.source).toBe('test');
      expect(state1!.metadata.version).toBe('1.0.0');
      expect(state1!.metadata.checksum).toBe('abc123');
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle empty selective keys array', () => {
      const snapshotId = snapshotManager.createSnapshot('empty-keys', mockStates, []);

      const snapshot = snapshotManager.getSnapshot('empty-keys');
      expect(snapshot).toBeDefined();
      expect(snapshot!.states.size).toBe(3); // Should include all states when keys array is empty
    });

    test('should handle selective restoration with empty array', () => {
      snapshotManager.createSnapshot('empty-restore', mockStates);
      const targetStates = new Map<string, PreservedState>();

      const restored = snapshotManager.restoreFromSnapshot('empty-restore', targetStates, []);

      expect(restored).toBe(true);
      expect(targetStates.size).toBe(3); // Should restore all states when selective array is empty
    });

    test('should handle states with undefined expiration', () => {
      const stateWithoutExpiration: PreservedState = {
        id: 'no-expiry',
        timestamp: Date.now(),
        data: { persistent: true },
        metadata: {
          source: 'test',
          version: '1.0.0',
          checksum: 'xyz789',
        },
        // No expiresAt property
      };

      const statesMap = new Map<string, PreservedState>();
      statesMap.set('no-expiry', stateWithoutExpiration);

      const snapshotId = snapshotManager.createSnapshot('no-expiry-test', statesMap);
      expect(snapshotId).toBeDefined();

      const snapshot = snapshotManager.getSnapshot('no-expiry-test');
      expect(snapshot).toBeDefined();
      expect(snapshot!.states.get('no-expiry')).toBeDefined();
    });

    test('should handle overwriting existing snapshot names', () => {
      snapshotManager.createSnapshot('overwrite-test', mockStates);
      const originalSnapshot = snapshotManager.getSnapshot('overwrite-test');

      // Create another snapshot with same name
      const newStates = new Map<string, PreservedState>();
      newStates.set('new-state', {
        id: 'new-state',
        timestamp: Date.now(),
        data: { new: true },
        metadata: { source: 'new', version: '2.0.0', checksum: 'new123' },
      });

      snapshotManager.createSnapshot('overwrite-test', newStates);
      const newSnapshot = snapshotManager.getSnapshot('overwrite-test');

      expect(newSnapshot).toBeDefined();
      expect(newSnapshot!.states.size).toBe(1);
      expect(newSnapshot!.states.has('new-state')).toBe(true);
      expect(newSnapshot!.states.has('state1')).toBe(false);
    });
  });
});