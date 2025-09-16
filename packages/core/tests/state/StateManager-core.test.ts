import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { StateManager } from '../../src/state/manager/StateManager';
import { mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('StateManager - Core Functionality', () => {
  let stateManager: StateManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'test-state-core-'));
    stateManager = new StateManager(tempDir);
  });

  afterEach(async () => {
    await stateManager.cleanup();
  });

  describe('initialization', () => {
    it('should initialize state successfully', async () => {
      const state = await stateManager.initializeState();

      expect(state).toBeDefined();
      expect(state.version).toBeDefined();
      expect(state.schemaVersion).toBeDefined();
      expect(state.completedSteps).toEqual([]);
      expect(state.recovery).toBeDefined();
      expect(state.conflicts).toBeDefined();
      expect(state.checksum).toBeDefined();
      expect(typeof state.checksum).toBe('string');
    });

    it('should get current state after initialization', async () => {
      await stateManager.initializeState();
      const currentState = stateManager.getCurrentState();

      expect(currentState).toBeDefined();
      expect(currentState?.version).toBeDefined();
    });

    it('should return undefined for current state before initialization', () => {
      const currentState = stateManager.getCurrentState();
      expect(currentState).toBeUndefined();
    });

    it('should handle state initialization consistently', async () => {
      const state = await stateManager.initializeState();

      expect(state.version).toBeDefined();
      expect(state.schemaVersion).toBeDefined();
      expect(state.checksum).toBeDefined();
    });
  });

  describe('state archival', () => {
    it('should archive state and clear current state', async () => {
      await stateManager.initializeState();
      expect(stateManager.getCurrentState()).toBeDefined();

      await stateManager.archiveState();
      expect(stateManager.getCurrentState()).toBeUndefined();
    });

    it('should handle archival operations', async () => {
      await stateManager.archiveState();
      expect(stateManager.getCurrentState()).toBeUndefined();
    });

    it('should allow reinitialization after archival', async () => {
      await stateManager.initializeState();
      await stateManager.archiveState();

      const newState = await stateManager.initializeState();
      expect(newState).toBeDefined();
      expect(newState.version).toBeDefined();
    });
  });

  describe('backup operations', () => {
    it('should list backups', async () => {
      await stateManager.initializeState();
      const backups = await stateManager.listBackups();

      expect(Array.isArray(backups)).toBe(true);
    });

    it('should handle backup restoration when backups exist', async () => {
      await stateManager.initializeState();
      const backups = await stateManager.listBackups();

      if (backups.length > 0) {
        await expect(stateManager.restoreFromBackup(backups[0].path)).resolves.not.toThrow();
      } else {
        // Test error handling for invalid backup paths
        await expect(stateManager.restoreFromBackup('/invalid/path')).rejects.toThrow();
      }
    });

    it('should handle invalid backup path gracefully', async () => {
      await stateManager.initializeState();
      await expect(stateManager.restoreFromBackup('/invalid/path')).rejects.toThrow();
    });
  });

  describe('migration operations', () => {
    it('should check migration status', async () => {
      await stateManager.initializeState();
      const status = await stateManager.checkMigrationStatus();

      expect(status).toHaveProperty('currentVersion');
      expect(status).toHaveProperty('latestVersion');
      expect(status).toHaveProperty('targetVersion');
      expect(status).toHaveProperty('needsMigration');
      expect(status).toHaveProperty('availableMigrations');
      expect(status).toHaveProperty('migrationPath');

      expect(typeof status.needsMigration).toBe('boolean');
      expect(Array.isArray(status.availableMigrations)).toBe(true);
      expect(Array.isArray(status.migrationPath)).toBe(true);
    });

    it('should handle migration status for new installation', async () => {
      const status = await stateManager.checkMigrationStatus();

      expect(status.needsMigration).toBe(false);
      expect(status.migrationPath).toHaveLength(0);
    });

    it('should provide consistent migration information', async () => {
      await stateManager.initializeState();
      const status1 = await stateManager.checkMigrationStatus();
      const status2 = await stateManager.checkMigrationStatus();

      expect(status1.needsMigration).toBe(status2.needsMigration);
      expect(status1.currentVersion).toBe(status2.currentVersion);
      expect(status1.latestVersion).toBe(status2.latestVersion);
    });
  });

  describe('recovery state tracking', () => {
    it('should track recovery state', async () => {
      const isRecovering = stateManager.isRecoveringState();
      expect(typeof isRecovering).toBe('boolean');
      expect(isRecovering).toBe(false); // Should not be recovering initially
    });

    it('should maintain recovery state during operations', async () => {
      await stateManager.initializeState();

      // Should not be recovering during normal operations
      expect(stateManager.isRecoveringState()).toBe(false);

      const backups = await stateManager.listBackups();
      expect(stateManager.isRecoveringState()).toBe(false);
    });

    it('should handle recovery state during restore operations', async () => {
      await stateManager.initializeState();
      const backups = await stateManager.listBackups();

      if (backups.length > 0) {
        const restorePromise = stateManager.restoreFromBackup(backups[0].path);
        await restorePromise;

        // After completion, should not be recovering
        expect(stateManager.isRecoveringState()).toBe(false);
      }
    });
  });

  describe('cleanup operations', () => {
    it('should cleanup resources properly', async () => {
      await stateManager.initializeState();
      const state = stateManager.getCurrentState();
      expect(state).toBeDefined();

      await stateManager.cleanup();

      const cleanedState = stateManager.getCurrentState();
      expect(cleanedState).toBeUndefined();
    });

    it('should handle cleanup operations', async () => {
      await stateManager.cleanup();
      expect(stateManager.getCurrentState()).toBeUndefined();
    });

    it('should handle cleanup and workflow completion', async () => {
      await stateManager.initializeState();

      // Verify state is initialized
      expect(stateManager.getCurrentState()).toBeDefined();

      await stateManager.cleanup();

      // Verify cleanup worked
      expect(stateManager.getCurrentState()).toBeUndefined();
    });
  });

  describe('state consistency', () => {
    it('should maintain state structure integrity', async () => {
      const state = await stateManager.initializeState();

      expect(state).toHaveProperty('version');
      expect(state).toHaveProperty('schemaVersion');
      expect(state).toHaveProperty('checksum');
      expect(state).toHaveProperty('completedSteps');
      expect(state).toHaveProperty('recovery');
      expect(state).toHaveProperty('conflicts');
      expect(state).toHaveProperty('metadata');

      expect(state.checksum).toBeDefined();
      expect(typeof state.checksum).toBe('string');
      expect(Array.isArray(state.completedSteps)).toBe(true);
    });

    it('should provide consistent state access', async () => {
      const initialState = await stateManager.initializeState();
      const currentState1 = stateManager.getCurrentState();
      const currentState2 = stateManager.getCurrentState();

      expect(currentState1?.version).toBe(initialState.version);
      expect(currentState2?.version).toBe(initialState.version);
      expect(currentState1?.checksum).toBe(currentState2?.checksum);
    });

    it('should handle state operations consistently', async () => {
      await stateManager.initializeState();

      const status1 = await stateManager.checkMigrationStatus();
      const backups1 = await stateManager.listBackups();

      const status2 = await stateManager.checkMigrationStatus();
      const backups2 = await stateManager.listBackups();

      expect(status1.needsMigration).toBe(status2.needsMigration);
      expect(backups1.length).toBe(backups2.length);
    });
  });

  describe('error handling', () => {
    it('should handle manager operations gracefully', async () => {
      // Test operations that should not throw
      expect(stateManager.getCurrentState()).toBeUndefined();
      expect(stateManager.isRecoveringState()).toBe(false);

      // These operations should complete successfully
      const status = await stateManager.checkMigrationStatus();
      expect(status).toBeDefined();
      expect(typeof status.needsMigration).toBe('boolean');

      const backups = await stateManager.listBackups();
      expect(Array.isArray(backups)).toBe(true);
    });

    it('should handle invalid paths in backup operations', async () => {
      await stateManager.initializeState();

      await expect(stateManager.restoreFromBackup('/invalid/path/backup.yaml')).rejects.toThrow();
      await expect(stateManager.restoreFromBackup('')).rejects.toThrow();
    });

    it('should maintain state after failed operations', async () => {
      await stateManager.initializeState();
      const initialState = stateManager.getCurrentState();

      // Try invalid backup restore
      try {
        await stateManager.restoreFromBackup('/invalid/path');
      } catch (error) {
        // Expected to fail
      }

      // State should remain consistent
      const stateAfterError = stateManager.getCurrentState();
      expect(stateAfterError?.version).toBe(initialState?.version);
    });
  });

  describe('performance considerations', () => {
    it('should initialize quickly', async () => {
      const startTime = Date.now();
      await stateManager.initializeState();
      const initTime = Date.now() - startTime;

      expect(initTime).toBeLessThan(2000); // Should initialize within 2 seconds
    });

    it('should handle repeated operations efficiently', async () => {
      await stateManager.initializeState();

      const startTime = Date.now();

      for (let i = 0; i < 10; i++) {
        await stateManager.checkMigrationStatus();
        await stateManager.listBackups();
        stateManager.getCurrentState();
        stateManager.isRecoveringState();
      }

      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(5000); // Should complete 40 operations within 5 seconds
    });

    it('should handle concurrent status checks', async () => {
      await stateManager.initializeState();

      const promises = Array.from({ length: 5 }, () =>
        stateManager.checkMigrationStatus()
      );

      const results = await Promise.all(promises);

      // All results should be consistent
      results.forEach(result => {
        expect(result.needsMigration).toBe(results[0].needsMigration);
        expect(result.currentVersion).toBe(results[0].currentVersion);
      });
    });
  });

  describe('integration workflow', () => {
    it('should support complete initialization workflow', async () => {
      // Initialize
      const state = await stateManager.initializeState();
      expect(state).toBeDefined();

      // Check status
      const status = await stateManager.checkMigrationStatus();
      expect(status.needsMigration).toBe(false);

      // List backups
      const backups = await stateManager.listBackups();
      expect(Array.isArray(backups)).toBe(true);

      // Get current state
      const current = stateManager.getCurrentState();
      expect(current?.version).toBe(state.version);

      // Archive
      await stateManager.archiveState();
      expect(stateManager.getCurrentState()).toBeUndefined();

      // Cleanup
      await stateManager.cleanup();
    });

    it('should handle manager lifecycle operations', async () => {
      // Test single lifecycle
      await stateManager.initializeState();
      expect(stateManager.getCurrentState()).toBeDefined();

      await stateManager.archiveState();
      expect(stateManager.getCurrentState()).toBeUndefined();

      // Final cleanup
      await stateManager.cleanup();
      expect(stateManager.getCurrentState()).toBeUndefined();
    });
  });
});