import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import * as yaml from 'js-yaml';

/**
 * State migration tests
 * Validates migration utilities for schema version upgrades
 */

interface StateV1 {
  version: '1.0.0';
  activeInstance?: {
    id: string;
    status: string;
  };
  completedSteps: Array<{
    stepId: string;
    completedAt: string;
  }>;
}

interface StateV2 {
  schemaVersion: '2.0.0';
  checksum: string;
  activeInstance?: {
    id: string;
    status: string;
    templateVersion: string;
  };
  completedSteps: Array<{
    stepId: string;
    completedAt: string;
    executionTime: number;
  }>;
  recovery?: {
    lastCorruption?: string;
    corruptionType?: string;
  };
}

class StateMigrator {
  /**
   * Migrate state from v1 to v2
   */
  static migrateV1ToV2(v1State: StateV1): StateV2 {
    const v2State: StateV2 = {
      schemaVersion: '2.0.0',
      checksum: '',
      completedSteps: v1State.completedSteps.map((step) => ({
        ...step,
        executionTime: 0, // Default value for new field
      })),
    };

    if (v1State.activeInstance) {
      v2State.activeInstance = {
        ...v1State.activeInstance,
        templateVersion: '1.0.0', // Default template version
      };
    }

    // Calculate checksum
    v2State.checksum = this.calculateChecksum(v2State);

    return v2State;
  }

  /**
   * Detect state version
   */
  static detectVersion(state: any): string {
    if (state.schemaVersion) {
      return state.schemaVersion;
    }
    if (state.version) {
      return state.version;
    }
    // Legacy state without version
    return '0.0.0';
  }

  /**
   * Check if migration is needed
   */
  static needsMigration(
    currentVersion: string,
    targetVersion: string
  ): boolean {
    const current = this.parseVersion(currentVersion);
    const target = this.parseVersion(targetVersion);

    return (
      current.major < target.major ||
      (current.major === target.major && current.minor < target.minor)
    );
  }

  /**
   * Parse semantic version
   */
  static parseVersion(version: string): {
    major: number;
    minor: number;
    patch: number;
  } {
    const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number);
    return { major, minor, patch };
  }

  /**
   * Calculate state checksum
   */
  static calculateChecksum(state: any): string {
    const stateWithoutChecksum = { ...state };
    delete stateWithoutChecksum.checksum;

    const content = JSON.stringify(
      stateWithoutChecksum,
      Object.keys(stateWithoutChecksum).sort()
    );
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Validate migrated state
   */
  static validateMigratedState(state: StateV2): boolean {
    // Check required fields
    if (!state.schemaVersion || !state.checksum) {
      return false;
    }

    // Validate checksum
    const expectedChecksum = this.calculateChecksum(state);
    if (state.checksum !== expectedChecksum) {
      return false;
    }

    // Validate structure
    if (!Array.isArray(state.completedSteps)) {
      return false;
    }

    // Validate new fields exist
    for (const step of state.completedSteps) {
      if (typeof step.executionTime !== 'number') {
        return false;
      }
    }

    if (state.activeInstance && !state.activeInstance.templateVersion) {
      return false;
    }

    return true;
  }

  /**
   * Migrate state file
   */
  static async migrateStateFile(
    filePath: string,
    backupDir: string
  ): Promise<void> {
    // Read current state
    const file = Bun.file(filePath);
    const content = await file.text();
    const currentState = yaml.load(content) as any;

    // Detect version
    const version = this.detectVersion(currentState);

    // Check if migration needed
    if (!this.needsMigration(version, '2.0.0')) {
      return;
    }

    // Create backup
    const backupPath = path.join(
      backupDir,
      `state.yaml.pre-migration-${Date.now()}`
    );
    await Bun.write(backupPath, content);

    // Perform migration
    let migratedState: StateV2;

    switch (version) {
      case '0.0.0':
        // Legacy to v1 first, then v1 to v2
        const v1State: StateV1 = {
          version: '1.0.0',
          ...currentState,
        };
        migratedState = this.migrateV1ToV2(v1State);
        break;

      case '1.0.0':
        migratedState = this.migrateV1ToV2(currentState as StateV1);
        break;

      default:
        throw new Error(`Unsupported state version: ${version}`);
    }

    // Validate migrated state
    if (!this.validateMigratedState(migratedState)) {
      throw new Error('Migration validation failed');
    }

    // Write migrated state
    const migratedContent = yaml.dump(migratedState, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });

    await Bun.write(filePath, migratedContent);
  }

  /**
   * Rollback migration
   */
  static async rollbackMigration(
    filePath: string,
    backupPath: string
  ): Promise<void> {
    const backup = Bun.file(backupPath);
    if (!(await backup.exists())) {
      throw new Error('Backup file not found');
    }

    const backupContent = await backup.text();
    await Bun.write(filePath, backupContent);
  }
}

describe('State Migration', () => {
  describe('detectVersion', () => {
    test('should detect v2 schema version', () => {
      const state = { schemaVersion: '2.0.0' };
      expect(StateMigrator.detectVersion(state)).toBe('2.0.0');
    });

    test('should detect v1 version field', () => {
      const state = { version: '1.0.0' };
      expect(StateMigrator.detectVersion(state)).toBe('1.0.0');
    });

    test('should return 0.0.0 for legacy state', () => {
      const state = { activeInstance: {} };
      expect(StateMigrator.detectVersion(state)).toBe('0.0.0');
    });
  });

  describe('needsMigration', () => {
    test('should need migration for major version upgrade', () => {
      expect(StateMigrator.needsMigration('1.0.0', '2.0.0')).toBe(true);
      expect(StateMigrator.needsMigration('0.0.0', '1.0.0')).toBe(true);
    });

    test('should need migration for minor version upgrade', () => {
      expect(StateMigrator.needsMigration('2.0.0', '2.1.0')).toBe(true);
      expect(StateMigrator.needsMigration('2.1.0', '2.2.0')).toBe(true);
    });

    test('should not need migration for patch version', () => {
      expect(StateMigrator.needsMigration('2.0.0', '2.0.1')).toBe(false);
      expect(StateMigrator.needsMigration('2.1.0', '2.1.5')).toBe(false);
    });

    test('should not need migration for same version', () => {
      expect(StateMigrator.needsMigration('2.0.0', '2.0.0')).toBe(false);
    });

    test('should not need migration for downgrade', () => {
      expect(StateMigrator.needsMigration('2.0.0', '1.0.0')).toBe(false);
    });
  });

  describe('migrateV1ToV2', () => {
    test('should migrate basic v1 state to v2', () => {
      const v1State: StateV1 = {
        version: '1.0.0',
        completedSteps: [
          { stepId: 'step1', completedAt: '2024-01-01T00:00:00Z' },
          { stepId: 'step2', completedAt: '2024-01-02T00:00:00Z' },
        ],
      };

      const v2State = StateMigrator.migrateV1ToV2(v1State);

      expect(v2State.schemaVersion).toBe('2.0.0');
      expect(v2State.checksum).toBeDefined();
      expect(v2State.completedSteps).toHaveLength(2);
      expect(v2State.completedSteps[0].executionTime).toBe(0);
      expect(v2State.completedSteps[1].executionTime).toBe(0);
    });

    test('should migrate v1 state with activeInstance', () => {
      const v1State: StateV1 = {
        version: '1.0.0',
        activeInstance: {
          id: 'instance-1',
          status: 'active',
        },
        completedSteps: [],
      };

      const v2State = StateMigrator.migrateV1ToV2(v1State);

      expect(v2State.activeInstance).toBeDefined();
      expect(v2State.activeInstance?.id).toBe('instance-1');
      expect(v2State.activeInstance?.status).toBe('active');
      expect(v2State.activeInstance?.templateVersion).toBe('1.0.0');
    });

    test('should calculate correct checksum', () => {
      const v1State: StateV1 = {
        version: '1.0.0',
        completedSteps: [],
      };

      const v2State = StateMigrator.migrateV1ToV2(v1State);
      const expectedChecksum = StateMigrator.calculateChecksum(v2State);

      expect(v2State.checksum).toBe(expectedChecksum);
    });
  });

  describe('validateMigratedState', () => {
    test('should validate correct v2 state', () => {
      const v2State: StateV2 = {
        schemaVersion: '2.0.0',
        checksum: '',
        completedSteps: [
          { stepId: 'step1', completedAt: '2024-01-01', executionTime: 100 },
        ],
      };

      // Fix checksum
      v2State.checksum = StateMigrator.calculateChecksum(v2State);

      expect(StateMigrator.validateMigratedState(v2State)).toBe(true);
    });

    test('should reject state without schemaVersion', () => {
      const invalidState: any = {
        checksum: 'abc',
        completedSteps: [],
      };

      expect(StateMigrator.validateMigratedState(invalidState)).toBe(false);
    });

    test('should reject state with invalid checksum', () => {
      const v2State: StateV2 = {
        schemaVersion: '2.0.0',
        checksum: 'invalid-checksum',
        completedSteps: [],
      };

      expect(StateMigrator.validateMigratedState(v2State)).toBe(false);
    });

    test('should reject state with missing executionTime', () => {
      const invalidState: any = {
        schemaVersion: '2.0.0',
        checksum: '',
        completedSteps: [
          { stepId: 'step1', completedAt: '2024-01-01' }, // Missing executionTime
        ],
      };

      invalidState.checksum = StateMigrator.calculateChecksum(invalidState);

      expect(StateMigrator.validateMigratedState(invalidState)).toBe(false);
    });

    test('should reject activeInstance without templateVersion', () => {
      const invalidState: any = {
        schemaVersion: '2.0.0',
        checksum: '',
        activeInstance: {
          id: 'instance-1',
          status: 'active',
          // Missing templateVersion
        },
        completedSteps: [],
      };

      invalidState.checksum = StateMigrator.calculateChecksum(invalidState);

      expect(StateMigrator.validateMigratedState(invalidState)).toBe(false);
    });
  });

  describe('migrateStateFile', () => {
    const testDir = path.join(process.cwd(), '.test-migration');
    const stateFile = path.join(testDir, 'state.yaml');
    const backupDir = path.join(testDir, 'backups');

    beforeEach(async () => {
      await fs.mkdir(testDir, { recursive: true });
      await fs.mkdir(backupDir, { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    test('should migrate v1 file to v2', async () => {
      const v1State: StateV1 = {
        version: '1.0.0',
        activeInstance: {
          id: 'test-instance',
          status: 'active',
        },
        completedSteps: [
          { stepId: 'step1', completedAt: '2024-01-01T00:00:00Z' },
        ],
      };

      // Write v1 state file
      await Bun.write(stateFile, yaml.dump(v1State));

      // Perform migration
      await StateMigrator.migrateStateFile(stateFile, backupDir);

      // Read migrated file
      const migratedContent = await Bun.file(stateFile).text();
      const migratedState = yaml.load(migratedContent) as StateV2;

      expect(migratedState.schemaVersion).toBe('2.0.0');
      expect(migratedState.checksum).toBeDefined();
      expect(migratedState.activeInstance?.templateVersion).toBe('1.0.0');
      expect(migratedState.completedSteps[0].executionTime).toBe(0);
    });

    test('should create backup before migration', async () => {
      const v1State: StateV1 = {
        version: '1.0.0',
        completedSteps: [],
      };

      await Bun.write(stateFile, yaml.dump(v1State));
      await StateMigrator.migrateStateFile(stateFile, backupDir);

      const backupFiles = await fs.readdir(backupDir);
      expect(backupFiles.length).toBe(1);
      expect(backupFiles[0]).toContain('state.yaml.pre-migration');
    });

    test('should skip migration if already on target version', async () => {
      const v2State: StateV2 = {
        schemaVersion: '2.0.0',
        checksum: 'test',
        completedSteps: [],
      };

      const originalContent = yaml.dump(v2State);
      await Bun.write(stateFile, originalContent);

      await StateMigrator.migrateStateFile(stateFile, backupDir);

      const finalContent = await Bun.file(stateFile).text();
      expect(finalContent).toBe(originalContent);

      const backupFiles = await fs.readdir(backupDir);
      expect(backupFiles.length).toBe(0);
    });

    test('should handle legacy state (0.0.0)', async () => {
      const legacyState = {
        activeInstance: {
          id: 'legacy-instance',
          status: 'active',
        },
        completedSteps: [{ stepId: 'step1', completedAt: '2024-01-01' }],
      };

      await Bun.write(stateFile, yaml.dump(legacyState));
      await StateMigrator.migrateStateFile(stateFile, backupDir);

      const migratedContent = await Bun.file(stateFile).text();
      const migratedState = yaml.load(migratedContent) as StateV2;

      expect(migratedState.schemaVersion).toBe('2.0.0');
      expect(migratedState.activeInstance?.templateVersion).toBe('1.0.0');
      expect(migratedState.completedSteps[0].executionTime).toBe(0);
    });
  });

  describe('rollbackMigration', () => {
    const testDir = path.join(process.cwd(), '.test-rollback');
    const stateFile = path.join(testDir, 'state.yaml');
    const backupFile = path.join(testDir, 'state.yaml.backup');

    beforeEach(async () => {
      await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    test('should rollback to backup file', async () => {
      const originalContent = 'original: state\nversion: 1.0.0\n';
      const modifiedContent = 'modified: state\nschemaVersion: 2.0.0\n';

      await Bun.write(backupFile, originalContent);
      await Bun.write(stateFile, modifiedContent);

      await StateMigrator.rollbackMigration(stateFile, backupFile);

      const rolledBackContent = await Bun.file(stateFile).text();
      expect(rolledBackContent).toBe(originalContent);
    });

    test('should throw if backup file not found', async () => {
      await Bun.write(stateFile, 'current: state');

      await expect(
        StateMigrator.rollbackMigration(stateFile, backupFile)
      ).rejects.toThrow('Backup file not found');
    });
  });
});
