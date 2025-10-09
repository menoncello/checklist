import { describe, test, expect, beforeEach, afterEach, mock} from 'bun:test';
import * as yaml from 'js-yaml';
import { StateInitializer} from '../../../src/state/manager/StateInitializer';
import { DirectoryManager} from '../../../src/state/DirectoryManager';
import { StateValidator} from '../../../src/state/validation';
import { MigrationRunner} from '../../../src/state/migrations/MigrationRunner';
import { StateError, StateCorruptedError} from '../../../src/state/errors';
import { SCHEMA_VERSION} from '../../../src/state/constants';
import type { ChecklistState} from '../../../src/state/types';
describe('StateInitializer', () => {
  let stateInitializer: StateInitializer;
  let mockDirectoryManager: DirectoryManager;
  let mockValidator: StateValidator;
  let mockMigrationRunner: MigrationRunner;

  const mockStatePath = '/mock/state/path.yaml';
  const mockValidState: ChecklistState = {
    version: SCHEMA_VERSION,
    schemaVersion: SCHEMA_VERSION,
    checksum: 'mock-checksum',
    completedSteps: [],
    recovery: { dataLoss: false },
    conflicts: {},
    metadata: {
      created: '2025-01-01T00:00:00Z',
      modified: '2025-01-01T00:00:00Z',
      template: 'default'
    }
  };

  beforeEach(() => {
    mockDirectoryManager = {
      ensureDirectoriesExist: mock(() => Promise.resolve()),
      getStatePath: mock(() => mockStatePath),
      fileExists: mock(() => Promise.resolve(true)),
      readFile: mock(() => Promise.resolve(yaml.dump(mockValidState))),
      writeFile: mock(() => Promise.resolve())
    } as any;

    mockValidator = {
      validateState: mock(() => ({ isValid: true, errors: [] }))
    } as any;

    mockMigrationRunner = {
      migrateState: mock(() => Promise.resolve(mockValidState))
    } as any;

    stateInitializer = new StateInitializer(
      mockDirectoryManager,
      mockValidator,
      mockMigrationRunner
    );
  });

  afterEach(() => {
    mock.restore();
  });

  describe('initializeState', () => {
    test('should initialize state successfully when file exists', async () => {
      const result = await stateInitializer.initializeState();

      expect(mockDirectoryManager.ensureDirectoriesExist).toHaveBeenCalled();
      expect(mockDirectoryManager.getStatePath).toHaveBeenCalled();
      expect(mockDirectoryManager.fileExists).toHaveBeenCalledWith(mockStatePath);
      expect(result).toEqual(mockValidState);
    });

    test('should create new state when file does not exist', async () => {
      mockDirectoryManager.fileExists = mock(() => Promise.resolve(false));

      const result = await stateInitializer.initializeState();

      expect(mockDirectoryManager.ensureDirectoriesExist).toHaveBeenCalled();
      expect(mockDirectoryManager.writeFile).toHaveBeenCalled();
      expect(result.version).toBe(SCHEMA_VERSION);
      expect(result.schemaVersion).toBe(SCHEMA_VERSION);
      expect(result.completedSteps).toEqual([]);
      expect(result.recovery.dataLoss).toBe(false);
    });

    test('should throw StateError when directory creation fails', async () => {
      const error = new Error('Directory creation failed');
      mockDirectoryManager.ensureDirectoriesExist = mock(() => Promise.reject(error));

      await expect(stateInitializer.initializeState()).rejects.toThrow(StateError);
      await expect(stateInitializer.initializeState()).rejects.toThrow('Failed to initialize state: Directory creation failed');
    });

    test('should throw StateError when file existence check fails', async () => {
      const error = new Error('File check failed');
      mockDirectoryManager.fileExists = mock(() => Promise.reject(error));

      await expect(stateInitializer.initializeState()).rejects.toThrow(StateError);
      await expect(stateInitializer.initializeState()).rejects.toThrow('Failed to initialize state: File check failed');
    });
  });

  describe('loadExistingState', () => {
    test('should load and validate existing state successfully', async () => {
      const result = await stateInitializer.initializeState();

      expect(mockDirectoryManager.readFile).toHaveBeenCalledWith(mockStatePath);
      expect(mockValidator.validateState).toHaveBeenCalled();
      expect(result).toEqual(mockValidState);
    });

    test('should throw StateError when state validation fails', async () => {
      mockValidator.validateState = mock(() => ({
        isValid: false,
        errors: ['Invalid schema', 'Missing required field']
      }));

      await expect(stateInitializer.initializeState()).rejects.toThrow(StateError);
      await expect(stateInitializer.initializeState()).rejects.toThrow('Failed to initialize state');
    });

    test('should handle YAML parsing errors', async () => {
      mockDirectoryManager.readFile = mock(() => Promise.resolve('invalid: yaml: content:'));

      await expect(stateInitializer.initializeState()).rejects.toThrow(StateError);
    });

    test('should handle file read errors', async () => {
      const error = new Error('File read failed');
      mockDirectoryManager.readFile = mock(() => Promise.reject(error));

      await expect(stateInitializer.initializeState()).rejects.toThrow(StateError);
      await expect(stateInitializer.initializeState()).rejects.toThrow('Failed to initialize state: File read failed');
    });
  });

  describe('handleMigrationIfNeeded', () => {
    test('should not migrate when versions match', async () => {
      const result = await stateInitializer.initializeState();

      expect(mockMigrationRunner.migrateState).not.toHaveBeenCalled();
      expect(result).toEqual(mockValidState);
    });

    test('should migrate when versions differ', async () => {
      // Since SCHEMA_VERSION equals mockValidState.version, use different version
      const oldState = {
        ...mockValidState,
        version: '0.9.0'
      };
      mockDirectoryManager.readFile = mock(() => Promise.resolve(yaml.dump(oldState)));

      const migratedState = {
        ...mockValidState,
        version: SCHEMA_VERSION
      };
      mockMigrationRunner.migrateState = mock(() => Promise.resolve(migratedState)) as unknown as typeof mockMigrationRunner.migrateState;

      const result = await stateInitializer.initializeState();

      expect(mockMigrationRunner.migrateState).toHaveBeenCalledWith(
        oldState,
        '0.9.0',
        SCHEMA_VERSION
      );
      expect(result).toEqual(migratedState);
    });

    test('should handle state without version (default to 1.0.0)', async () => {
      const stateWithoutVersion = {
        schemaVersion: SCHEMA_VERSION,
        checksum: 'mock-checksum',
        completedSteps: [],
        recovery: { dataLoss: false },
        conflicts: {}
      };

      mockDirectoryManager.readFile = mock(() => Promise.resolve(yaml.dump(stateWithoutVersion)));

      await stateInitializer.initializeState();

      expect(mockMigrationRunner.migrateState).toHaveBeenCalledWith(
        stateWithoutVersion,
        '1.0.0',
        SCHEMA_VERSION
      );
    });

    test('should handle migration errors', async () => {
      const oldState = {
        ...mockValidState,
        version: '0.9.0'
      };
      mockDirectoryManager.readFile = mock(() => Promise.resolve(yaml.dump(oldState)));

      const migrationError = new Error('Migration failed');
      mockMigrationRunner.migrateState = mock(() => Promise.reject(migrationError));

      await expect(stateInitializer.initializeState()).rejects.toThrow(StateError);
      await expect(stateInitializer.initializeState()).rejects.toThrow('Failed to initialize state: Migration failed');
    });
  });

  describe('createNewState', () => {
    test('should create and save new state successfully', async () => {
      mockDirectoryManager.fileExists = mock(() => Promise.resolve(false));

      const result = await stateInitializer.initializeState();

      expect(mockDirectoryManager.writeFile).toHaveBeenCalledWith(
        mockStatePath,
        expect.stringContaining('version:')
      );
      expect(result.version).toBe(SCHEMA_VERSION);
      expect(result.schemaVersion).toBe(SCHEMA_VERSION);
      expect(result.completedSteps).toEqual([]);
      expect(result.recovery.dataLoss).toBe(false);
      expect(result.conflicts).toEqual({});
      expect(result.metadata?.template).toBe('default');
      expect(result.metadata?.created).toBeDefined();
      expect(result.metadata?.modified).toBeDefined();
    });

    test('should handle file write errors during new state creation', async () => {
      mockDirectoryManager.fileExists = mock(() => Promise.resolve(false));
      const writeError = new Error('Write failed');
      mockDirectoryManager.writeFile = mock(() => Promise.reject(writeError));

      await expect(stateInitializer.initializeState()).rejects.toThrow(StateError);
      await expect(stateInitializer.initializeState()).rejects.toThrow('Failed to initialize state: Write failed');
    });
  });

  describe('createEmptyState', () => {
    test('should create empty state with correct structure', async () => {
      mockDirectoryManager.fileExists = mock(() => Promise.resolve(false));

      const result = await stateInitializer.initializeState();

      expect(result).toHaveProperty('version', SCHEMA_VERSION);
      expect(result).toHaveProperty('schemaVersion', SCHEMA_VERSION);
      expect(result).toHaveProperty('checksum', '');
      expect(result).toHaveProperty('completedSteps', []);
      expect(result).toHaveProperty('recovery', { dataLoss: false });
      expect(result).toHaveProperty('conflicts', {});
      expect(result.metadata).toHaveProperty('template', 'default');
      expect(result.metadata?.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result.metadata?.modified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('saveNewState', () => {
    test('should save state as YAML with correct formatting', async () => {
      mockDirectoryManager.fileExists = mock(() => Promise.resolve(false));

      await stateInitializer.initializeState();

      expect(mockDirectoryManager.writeFile).toHaveBeenCalled();
      const writeCall = (mockDirectoryManager.writeFile as any).mock.calls[0];
      const [path, content] = writeCall;

      expect(path).toBe(mockStatePath);
      expect(content).toContain('version:');
      expect(content).toContain('schemaVersion:');
      expect(content).toContain('completedSteps: []');
      expect(content).toContain('dataLoss: false');

      // Verify YAML formatting
      const parsed = yaml.load(content) as ChecklistState;
      expect(parsed.version).toBe(SCHEMA_VERSION);
      expect(parsed.completedSteps).toEqual([]);
    });
  });

  describe('error handling and edge cases', () => {
    test('should handle invalid YAML content gracefully', async () => {
      mockDirectoryManager.readFile = mock(() => Promise.resolve('invalid yaml content: [missing bracket'));

      await expect(stateInitializer.initializeState()).rejects.toThrow(StateError);
    });

    test('should handle null state from YAML parsing', async () => {
      mockDirectoryManager.readFile = mock(() => Promise.resolve(''));

      await expect(stateInitializer.initializeState()).rejects.toThrow();
    });

    test('should handle validation with multiple errors', async () => {
      mockValidator.validateState = mock(() => ({
        isValid: false,
        errors: ['Error 1', 'Error 2', 'Error 3']
      }));

      await expect(stateInitializer.initializeState()).rejects.toThrow('Invalid state: Error 1, Error 2, Error 3');
    });

    test('should maintain state structure consistency during migration', async () => {
      const oldState = {
        version: '1.0.0',
        schemaVersion: '1.0.0',
        checksum: 'old-checksum',
        completedSteps: [
          {
            stepId: 'step1',
            completedAt: '2025-01-01T00:00:00Z',
            executionTime: 100,
            result: 'success' as const,
            commandResults: []
          }
        ],
        recovery: { dataLoss: true },
        conflicts: { detected: '2025-01-01T00:00:00Z' }
      };

      mockDirectoryManager.readFile = mock(() => Promise.resolve(yaml.dump(oldState)));

      const migratedState = {
        ...oldState,
        version: SCHEMA_VERSION,
        schemaVersion: SCHEMA_VERSION
      };
      mockMigrationRunner.migrateState = mock(() => Promise.resolve(migratedState)) as unknown as typeof mockMigrationRunner.migrateState;

      const result = await stateInitializer.initializeState();

      expect(result.completedSteps).toHaveLength(1);
      expect(result.recovery.dataLoss).toBe(true);
      expect(result.conflicts.detected).toBeDefined();
    });
  });

  describe('integration scenarios', () => {
    test('should handle complete initialization flow with existing valid state', async () => {
      const complexState: ChecklistState = {
        version: SCHEMA_VERSION,
        schemaVersion: SCHEMA_VERSION,
        checksum: 'complex-checksum',
        activeInstance: {
          id: 'instance-1',
          templateId: 'template-1',
          templateVersion: '1.0.0',
          projectPath: '/project/path',
          status: 'active',
          currentStepId: 'step-1',
          startedAt: '2025-01-01T00:00:00Z',
          lastModifiedAt: '2025-01-01T01:00:00Z'
        },
        completedSteps: [
          {
            stepId: 'step-1',
            completedAt: '2025-01-01T00:30:00Z',
            executionTime: 1000,
            result: 'success',
            commandResults: [
              {
                command: 'test command',
                exitCode: 0,
                stdout: 'success output',
                stderr: '',
                duration: 500
              }
            ]
          }
        ],
        recovery: {
          dataLoss: false,
          lastCorruption: '2025-01-01T00:00:00Z',
          corruptionType: 'checksum_mismatch',
          recoveryMethod: 'backup'
        },
        conflicts: {
          detected: '2025-01-01T00:00:00Z',
          resolution: 'local'
        },
        metadata: {
          created: '2025-01-01T00:00:00Z',
          modified: '2025-01-01T01:00:00Z',
          template: 'complex-template',
          customField: 'custom-value'
        },
        items: [
          {
            id: 'item-1',
            title: 'Test Item',
            completed: true,
            priority: 'high'
          }
        ]
      };

      mockDirectoryManager.readFile = mock(() => Promise.resolve(yaml.dump(complexState)));

      const result = await stateInitializer.initializeState();

      expect(result).toEqual(complexState);
      expect(result.activeInstance?.status).toBe('active');
      expect(result.completedSteps).toHaveLength(1);
      expect(result.items).toHaveLength(1);
    });

    test('should handle initialization with corrupt state and failure', async () => {
      mockValidator.validateState = mock(() => ({
        isValid: false,
        errors: ['Corruption detected']
      }));

      await expect(stateInitializer.initializeState()).rejects.toThrow(StateError);
      await expect(stateInitializer.initializeState()).rejects.toThrow('Failed to initialize state');
    });
  });
});