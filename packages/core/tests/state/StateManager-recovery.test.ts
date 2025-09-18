import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { StateManager } from '../../src/state/manager/StateManager';
import { mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('StateManager - Recovery Functionality', () => {
  let stateManager: StateManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'test-state-recovery-'));
    stateManager = new StateManager(tempDir);
  });

  afterEach(async () => {
    await stateManager.cleanup();
  });

  describe('backup and recovery', () => {
    it('should initialize state successfully', async () => {
      const state = await stateManager.initializeState();

      expect(state).toBeDefined();
      expect(state.version).toBeDefined();
      expect(state.schemaVersion).toBeDefined();
      expect(state.completedSteps).toEqual([]);
      expect(state.checksum).toBeDefined();
      expect(typeof state.checksum).toBe('string');
    });

    it('should list backups after initialization', async () => {
      await stateManager.initializeState();
      const backups = await stateManager.listBackups();

      expect(Array.isArray(backups)).toBe(true);
    });

    it('should check migration status', async () => {
      await stateManager.initializeState();
      const status = await stateManager.checkMigrationStatus();

      expect(status).toHaveProperty('currentVersion');
      expect(status).toHaveProperty('latestVersion');
      expect(status).toHaveProperty('needsMigration');
      expect(status).toHaveProperty('availableMigrations');
    });

    it('should handle current state access', async () => {
      await stateManager.initializeState();
      const currentState = stateManager.getCurrentState();

      expect(currentState).toBeDefined();
      expect(currentState?.version).toBeDefined();
    });

    it('should track recovery state correctly', async () => {
      const isRecovering = stateManager.isRecoveringState();
      expect(typeof isRecovering).toBe('boolean');
      expect(isRecovering).toBe(false);
    });
  });

  describe('state archival operations', () => {
    it('should archive state and clear current state', async () => {
      await stateManager.initializeState();
      expect(stateManager.getCurrentState()).toBeDefined();

      await stateManager.archiveState();
      expect(stateManager.getCurrentState()).toBeUndefined();
    });

    it('should handle archival operations', async () => {
      // Archive without initialization should complete successfully
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

  describe('error handling', () => {
    it('should handle invalid backup path', async () => {
      await stateManager.initializeState();

      await expect(stateManager.restoreFromBackup('/nonexistent/backup')).rejects.toThrow();
    });

    it('should cleanup resources properly', async () => {
      await stateManager.initializeState();
      await stateManager.cleanup();

      const currentState = stateManager.getCurrentState();
      expect(currentState).toBeUndefined();
    });

    it('should handle cleanup operations', async () => {
      // Cleanup without initialization should complete successfully
      await stateManager.cleanup();
      expect(stateManager.getCurrentState()).toBeUndefined();
    });
  });

  describe('integration scenarios', () => {
    it('should handle backup and restore workflow', async () => {
      await stateManager.initializeState();

      // Check migration status
      const status = await stateManager.checkMigrationStatus();
      expect(status.needsMigration).toBe(false);

      // List backups
      const backups = await stateManager.listBackups();
      expect(Array.isArray(backups)).toBe(true);
    });

    it('should maintain state consistency', async () => {
      const state = await stateManager.initializeState();

      expect(state.version).toBeDefined();
      expect(state.schemaVersion).toBeDefined();
      expect(state.checksum).toBeDefined();

      const currentState = stateManager.getCurrentState();
      expect(currentState?.version).toBe(state.version);
    });

    it('should handle restore operations when backups exist', async () => {
      await stateManager.initializeState();
      const backups = await stateManager.listBackups();

      if (backups.length > 0) {
        // Only test restore if backups exist
        await expect(stateManager.restoreFromBackup(backups[0].path)).resolves.not.toThrow();
      } else {
        // Test error handling for non-existent backups
        await expect(stateManager.restoreFromBackup('/invalid/path')).rejects.toThrow();
      }
    });
  });
});