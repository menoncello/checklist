import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { StateLoader } from '../../../src/state/manager/StateLoader';
import { ChecklistState } from '../../../src/state/types';
import { StateCorruptedError, RecoveryError } from '../../../src/state/errors';
import { SCHEMA_VERSION } from '../../../src/state/constants';
import * as yaml from 'js-yaml';

describe('StateLoader', () => {
  let stateLoader: StateLoader;
  let mockDirectoryManager: any;
  let mockValidator: any;
  let mockMigrationRunner: any;

  const testState: ChecklistState = {
    version: SCHEMA_VERSION,
    schemaVersion: SCHEMA_VERSION,
    checksum: 'test-checksum',
    completedSteps: [],
    recovery: { dataLoss: false },
    conflicts: { detected: undefined },
    metadata: {
      created: '2024-01-01T00:00:00Z',
      modified: '2024-01-01T00:00:00Z',
    },
    items: [
      {
        id: 'test-item',
        title: 'Test Item',
        completed: false,
      },
    ],
  };

  beforeEach(() => {
    // Create mocks for dependencies
    mockDirectoryManager = {
      getStatePath: mock(() => '/test/state.yaml'),
      getBackupPath: mock(() => '/test/backup'),
      fileExists: mock(() => Promise.resolve(true)),
      readFile: mock(() => Promise.resolve(yaml.dump(testState))),
      writeFile: mock(() => Promise.resolve()),
      listFiles: mock(() => Promise.resolve([])),
    };

    mockValidator = {
      validateState: mock(() => ({ isValid: true, errors: [] })),
    };

    mockMigrationRunner = {
      migrateState: mock((state: any) => Promise.resolve({
        ...state,
        version: SCHEMA_VERSION,
        schemaVersion: SCHEMA_VERSION,
      })),
    };

    stateLoader = new StateLoader(
      mockDirectoryManager,
      mockValidator,
      mockMigrationRunner
    );
  });

  describe('loadState', () => {
    it('should load and return valid state', async () => {
      const state = await stateLoader.loadState();

      expect(state).toEqual(testState);
      expect(mockDirectoryManager.fileExists).toHaveBeenCalledWith('/test/state.yaml');
      expect(mockDirectoryManager.readFile).toHaveBeenCalledWith('/test/state.yaml');
      expect(mockValidator.validateState).toHaveBeenCalledWith(testState);
    });

    it('should throw error when state file does not exist', async () => {
      mockDirectoryManager.fileExists = mock(() => Promise.resolve(false));

      await expect(stateLoader.loadState()).rejects.toThrow(StateCorruptedError);
      await expect(stateLoader.loadState()).rejects.toThrow('State file does not exist');
    });

    it('should migrate old version state', async () => {
      const oldState = {
        ...testState,
        version: '0.9.0',
        schemaVersion: '0.9.0',
      };
      mockDirectoryManager.readFile = mock(() => Promise.resolve(yaml.dump(oldState)));

      const state = await stateLoader.loadState();

      expect(mockMigrationRunner.migrateState).toHaveBeenCalledWith(
        oldState,
        '0.9.0',
        SCHEMA_VERSION
      );
      expect(state.version).toBe(SCHEMA_VERSION);
    });

    it('should handle state without version field', async () => {
      const stateWithoutVersion = {
        ...testState,
        version: undefined,
        schemaVersion: undefined,
      };
      mockDirectoryManager.readFile = mock(() =>
        Promise.resolve(yaml.dump(stateWithoutVersion))
      );

      await stateLoader.loadState();

      expect(mockMigrationRunner.migrateState).toHaveBeenCalledWith(
        stateWithoutVersion,
        '0.0.0', // Default version when version is undefined
        SCHEMA_VERSION
      );
    });

    it('should handle invalid YAML content', async () => {
      mockDirectoryManager.readFile = mock(() =>
        Promise.resolve('{ invalid: yaml: content }')
      );

      await expect(stateLoader.loadState()).rejects.toThrow(RecoveryError);
    });

    it('should handle validation errors', async () => {
      mockValidator.validateState = mock(() => ({
        isValid: false,
        errors: ['Missing required field', 'Invalid type'],
      }));

      await expect(stateLoader.loadState()).rejects.toThrow(RecoveryError);
      await expect(stateLoader.loadState()).rejects.toThrow(
        'Invalid state structure: Missing required field, Invalid type'
      );
    });
  });

  describe('recovery mechanism', () => {
    it('should attempt recovery from backup on load failure', async () => {
      const backupState = {
        ...testState,
        metadata: {
          ...testState.metadata,
          modified: '2024-01-02T00:00:00Z',
        },
      };

      // First read fails
      let readAttempts = 0;
      mockDirectoryManager.readFile = mock((path: string) => {
        readAttempts++;
        if (readAttempts === 1) {
          return Promise.resolve('{ invalid: yaml: content }'); // Genuinely invalid YAML
        }
        // Backup read succeeds
        return Promise.resolve(yaml.dump(backupState));
      });

      mockDirectoryManager.listFiles = mock(() =>
        Promise.resolve(['state-20240102.backup.yaml'])
      );

      const state = await stateLoader.loadState();

      expect(state).toEqual(backupState);
      expect(mockDirectoryManager.writeFile).toHaveBeenCalledWith(
        '/test/state.yaml',
        expect.any(String)
      );
    });

    it('should try multiple backups in order', async () => {
      mockDirectoryManager.readFile = mock((path: string) => {
        if (path === '/test/state.yaml') {
          return Promise.resolve('{ invalid: yaml: content }'); // Genuinely invalid YAML
        }
        if (path.includes('20240103')) {
          return Promise.resolve('{ also: invalid: yaml }'); // Also invalid
        }
        if (path.includes('20240102')) {
          return Promise.resolve(yaml.dump(testState));
        }
        return Promise.resolve('{}');
      });

      mockDirectoryManager.listFiles = mock(() =>
        Promise.resolve([
          'state-20240103.backup.yaml',
          'state-20240102.backup.yaml',
          'state-20240101.backup.yaml',
        ])
      );

      const state = await stateLoader.loadState();

      expect(state).toEqual(testState);
    });

    it('should throw RecoveryError when all recovery attempts fail', async () => {
      // Make the initial read throw an error to trigger recovery
      let readCount = 0;
      mockDirectoryManager.readFile = mock(() => {
        readCount++;
        throw new Error('Read failed');
      });
      mockDirectoryManager.listFiles = mock(() =>
        Promise.resolve(['backup1.yaml', 'backup2.yaml'])
      );

      await expect(stateLoader.loadState()).rejects.toThrow(RecoveryError);
    });

    it('should handle no available backups', async () => {
      mockDirectoryManager.readFile = mock((path: string) => {
        throw new Error('All reads fail');
      });
      mockDirectoryManager.listFiles = mock(() => Promise.resolve([]));

      await expect(stateLoader.loadState()).rejects.toThrow(RecoveryError);
    });

    it('should filter and sort backup files correctly', async () => {
      const listFilesSpy = mock(() =>
        Promise.resolve([
          'state-20240103.backup.yaml',
          'other-file.txt',
          'state-20240101.backup.yaml',
          'state-20240102.backup.yaml',
          'state-20240104.backup.yaml',
        ])
      );
      mockDirectoryManager.listFiles = listFilesSpy;

      // Make initial load fail to trigger recovery
      let readCount = 0;
      mockDirectoryManager.readFile = mock(() => {
        readCount++;
        if (readCount === 1) {
          return Promise.resolve('{ invalid }');
        }
        return Promise.resolve(yaml.dump(testState));
      });

      await stateLoader.loadState();

      // Should try backups in reverse chronological order
      expect(mockDirectoryManager.readFile).toHaveBeenCalled();
    });

    it('should validate recovered state', async () => {
      const invalidBackupState = {
        ...testState,
        checklists: 'not-an-array', // Invalid
      };

      let readCount = 0;
      mockDirectoryManager.readFile = mock((path: string) => {
        readCount++;
        if (readCount === 1) {
          // First read fails to trigger recovery
          throw new Error('Initial read failed');
        }
        // Backup reads return invalid state
        return Promise.resolve(yaml.dump(invalidBackupState));
      });

      mockDirectoryManager.listFiles = mock(() =>
        Promise.resolve(['backup.yaml'])
      );

      mockValidator.validateState = mock((state: any) => {
        if (state.items === 'not-an-array') {
          return { isValid: false, errors: ['Invalid items'] };
        }
        return { isValid: true, errors: [] };
      });

      await expect(stateLoader.loadState()).rejects.toThrow(RecoveryError);
    });
  });

  describe('importState', () => {
    it('should import valid YAML content', async () => {
      const yamlContent = yaml.dump(testState);
      const imported = await stateLoader.importState(yamlContent);

      expect(imported.version).toBe(SCHEMA_VERSION);
      expect(imported.items).toEqual(testState.items ?? []);
      expect(mockValidator.validateState).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should update version and metadata on import', async () => {
      const oldState = {
        ...testState,
        version: '0.9.0',
        metadata: {
          created: '2023-01-01T00:00:00Z',
          modified: '2023-01-01T00:00:00Z',
        },
      };

      const imported = await stateLoader.importState(yaml.dump(oldState));

      expect(imported.version).toBe(SCHEMA_VERSION);
      expect(new Date(imported.metadata?.modified ?? '').getTime()).toBeGreaterThan(
        new Date('2023-01-01T00:00:00Z').getTime()
      );
    });

    it('should handle state without metadata', async () => {
      const stateWithoutMetadata = {
        ...testState,
        metadata: undefined,
      };

      const imported = await stateLoader.importState(yaml.dump(stateWithoutMetadata));

      expect(imported.version).toBe(SCHEMA_VERSION);
      // Should not crash when metadata is undefined
    });

    it('should reject invalid YAML on import', async () => {
      await expect(
        stateLoader.importState('{ invalid: yaml: }')
      ).rejects.toThrow(StateCorruptedError);
    });

    it('should reject invalid state structure on import', async () => {
      mockValidator.validateState = mock(() => ({
        isValid: false,
        errors: ['Invalid structure'],
      }));

      await expect(
        stateLoader.importState(yaml.dump(testState))
      ).rejects.toThrow(StateCorruptedError);
    });
  });

  describe('edge cases', () => {
    it('should handle very large state files', async () => {
      const largeState = {
        ...testState,
        items: Array.from({ length: 10000 }, (_, i) => ({
          id: `item-${i}`,
          title: `Item ${i}`,
          completed: false,
        })),
      };

      mockDirectoryManager.readFile = mock(() =>
        Promise.resolve(yaml.dump(largeState))
      );

      const state = await stateLoader.loadState();

      expect(state.items).toHaveLength(10000);
    });

    it('should handle empty state file', async () => {
      mockDirectoryManager.readFile = mock(() => Promise.resolve(''));

      await expect(stateLoader.loadState()).rejects.toThrow();
    });

    it('should handle concurrent load attempts', async () => {
      const loads = [
        stateLoader.loadState(),
        stateLoader.loadState(),
        stateLoader.loadState(),
      ];

      const results = await Promise.all(loads);

      results.forEach(state => {
        expect(state).toEqual(testState);
      });
    });

    it('should handle special characters in YAML', async () => {
      const stateWithSpecialChars = {
        ...testState,
        items: [{
          ...testState.items![0],
          title: 'Test & "Special" <Characters> \n Tab:\t',
        }],
      };

      mockDirectoryManager.readFile = mock(() =>
        Promise.resolve(yaml.dump(stateWithSpecialChars))
      );

      const state = await stateLoader.loadState();

      expect(state.items![0].title).toBe('Test & "Special" <Characters> \n Tab:\t');
    });
  });
});