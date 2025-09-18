import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { StateSaver } from '../../../src/state/manager/StateSaver';
import { ChecklistState } from '../../../src/state/types';
import { StateError } from '../../../src/state/errors';
import * as yaml from 'js-yaml';

describe('StateSaver', () => {
  let stateSaver: StateSaver;
  let mockDirectoryManager: any;
  let mockConcurrencyManager: any;
  let mockTransactionCoordinator: any;
  let mockValidator: any;
  let mockBackupManager: any;
  let mockFieldEncryption: any;
  let mockSecretsDetector: any;

  const testState: ChecklistState = {
    version: '1.0.0',
    schemaVersion: '1.0.0',
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
      getArchivePath: mock(() => '/test/archive'),
      fileExists: mock(() => Promise.resolve(true)),
      readFile: mock(() => Promise.resolve(yaml.dump(testState))),
      writeFile: mock(() => Promise.resolve()),
      deleteFile: mock(() => Promise.resolve()),
    };

    mockConcurrencyManager = {
      withLock: mock(async (key: string, fn: Function) => fn()),
    };

    mockTransactionCoordinator = {
      beginTransaction: mock(() => Promise.resolve('tx-123')),
      commitTransaction: mock(() => Promise.resolve()),
      rollbackTransaction: mock(() => Promise.resolve()),
    };

    mockValidator = {
      validateState: mock(() => ({ isValid: true, errors: [] })),
    };

    mockBackupManager = {
      createBackup: mock(() => Promise.resolve()),
    };

    // Create StateSaver instance
    stateSaver = new StateSaver({
      directoryManager: mockDirectoryManager,
      concurrencyManager: mockConcurrencyManager,
      transactionCoordinator: mockTransactionCoordinator,
      validator: mockValidator,
      backupManager: mockBackupManager,
    });

    // Mock the private field encryption and secrets detector
    mockFieldEncryption = {
      encryptSensitiveFields: mock((state: any) => Promise.resolve(state)),
    };
    (stateSaver as any).fieldEncryption = mockFieldEncryption;

    mockSecretsDetector = {
      detectSecrets: mock(() => Promise.resolve(false)),
    };
    (stateSaver as any).secretsDetector = mockSecretsDetector;

    // Mock SecurityAudit static method (we'll mock it inline when needed)
  });

  describe('saveState', () => {
    it('should save state successfully with transaction', async () => {
      await stateSaver.saveState(testState);

      expect(mockConcurrencyManager.withLock).toHaveBeenCalledWith('state', expect.any(Function));
      expect(mockTransactionCoordinator.beginTransaction).toHaveBeenCalledWith(testState);
      expect(mockTransactionCoordinator.commitTransaction).toHaveBeenCalledWith('tx-123');
      expect(mockValidator.validateState).toHaveBeenCalledWith(testState);
      expect(mockDirectoryManager.writeFile).toHaveBeenCalled();
    });

    it('should rollback transaction on save failure', async () => {
      mockDirectoryManager.writeFile = mock(() =>
        Promise.reject(new Error('Write failed'))
      );

      await expect(stateSaver.saveState(testState)).rejects.toThrow('Write failed');

      expect(mockTransactionCoordinator.rollbackTransaction).toHaveBeenCalledWith('tx-123');
    });

    it('should validate state before saving', async () => {
      mockValidator.validateState = mock(() => ({
        isValid: false,
        errors: ['Invalid field X', 'Missing field Y'],
      }));

      await expect(stateSaver.saveState(testState)).rejects.toThrow(StateError);
      await expect(stateSaver.saveState(testState)).rejects.toThrow(
        'Invalid state: Invalid field X, Missing field Y'
      );
    });

    it('should detect and warn about secrets', async () => {
      mockSecretsDetector.detectSecrets = mock(() => Promise.resolve(true));
      const logSpy = mock(() => {});
      (stateSaver as any).logger.warn = logSpy;

      await stateSaver.saveState(testState);

      expect(mockSecretsDetector.detectSecrets).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith({
        msg: 'Potential secrets detected in state',
        secretCount: 1,
      });
    });

    it('should encrypt sensitive fields before saving', async () => {
      const encryptedState = { ...testState, encrypted: true };
      mockFieldEncryption.encryptSensitiveFields = mock(() =>
        Promise.resolve(encryptedState)
      );

      await stateSaver.saveState(testState);

      expect(mockFieldEncryption.encryptSensitiveFields).toHaveBeenCalledWith(
        expect.objectContaining({
          ...testState,
          metadata: expect.objectContaining({
            modified: expect.any(String),
          }),
        })
      );
    });

    it('should create backup before saving existing state', async () => {
      await stateSaver.saveState(testState);

      expect(mockDirectoryManager.fileExists).toHaveBeenCalledWith('/test/state.yaml');
      expect(mockBackupManager.createBackup).toHaveBeenCalledWith(testState);
    });

    it('should not create backup for new state file', async () => {
      mockDirectoryManager.fileExists = mock(() => Promise.resolve(false));

      await stateSaver.saveState(testState);

      expect(mockBackupManager.createBackup).not.toHaveBeenCalled();
    });

    it('should update metadata modified timestamp', async () => {
      await stateSaver.saveState(testState);

      const writeCall = mockDirectoryManager.writeFile.mock.calls[0];
      const savedContent = yaml.load(writeCall[1]) as ChecklistState;

      expect(savedContent.metadata?.modified).not.toBe(testState.metadata?.modified);
      expect(new Date(savedContent.metadata?.modified ?? '').getTime()).toBeGreaterThan(
        new Date(testState.metadata?.modified ?? '').getTime()
      );
    });

    it('should format YAML with proper settings', async () => {
      await stateSaver.saveState(testState);

      const writeCall = mockDirectoryManager.writeFile.mock.calls[0];
      expect(writeCall[0]).toBe('/test/state.yaml');
      expect(typeof writeCall[1]).toBe('string');
      expect(writeCall[1]).toContain('version: ');
    });
  });

  describe('exportState', () => {
    it('should export state without encryption', async () => {
      const exportedYaml = await stateSaver.exportState(testState);

      expect(mockFieldEncryption.encryptSensitiveFields).not.toHaveBeenCalled();
      expect(exportedYaml).toContain('version: ');
      expect(exportedYaml).toContain('exported: ');
    });

    it('should validate state before export', async () => {
      mockValidator.validateState = mock(() => ({
        isValid: false,
        errors: ['Invalid state'],
      }));

      await expect(stateSaver.exportState(testState)).rejects.toThrow(StateError);
    });

    it('should add export timestamp to metadata', async () => {
      const exportedYaml = await stateSaver.exportState(testState);
      const exportedState = yaml.load(exportedYaml) as ChecklistState;

      expect(exportedState.metadata?.exported).toBeDefined();
      expect(new Date((exportedState.metadata as any)?.exported ?? '').getTime()).toBeGreaterThan(0);
    });

    it('should format exported YAML properly', async () => {
      const exportedYaml = await stateSaver.exportState(testState);

      expect(exportedYaml).toContain('version: ');
      expect(exportedYaml).toContain('schemaVersion: ');
      expect(exportedYaml).toContain('items:');
    });
  });

  describe('archiveState', () => {
    it('should archive existing state file', async () => {
      await stateSaver.archiveState();

      expect(mockConcurrencyManager.withLock).toHaveBeenCalledWith(
        'archive',
        expect.any(Function)
      );
      expect(mockDirectoryManager.fileExists).toHaveBeenCalledWith('/test/state.yaml');
      expect(mockDirectoryManager.readFile).toHaveBeenCalledWith('/test/state.yaml');
      expect(mockDirectoryManager.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/test/archive/archived-'),
        expect.any(String)
      );
      expect(mockDirectoryManager.deleteFile).toHaveBeenCalledWith('/test/state.yaml');
    });

    it('should handle missing state file gracefully', async () => {
      mockDirectoryManager.fileExists = mock(() => Promise.resolve(false));
      const logSpy = mock(() => {});
      (stateSaver as any).logger.info = logSpy;

      await stateSaver.archiveState();

      expect(mockDirectoryManager.deleteFile).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith({ msg: 'No state file to archive' });
    });

    it('should create timestamped archive file', async () => {
      const beforeTime = Date.now();
      await stateSaver.archiveState();
      const afterTime = Date.now();

      const writeCall = mockDirectoryManager.writeFile.mock.calls[0];
      const archivePath = writeCall[0];

      expect(archivePath).toContain('/test/archive/archived-');
      expect(archivePath).toContain('.yaml');

      // Extract timestamp from filename
      const timestampMatch = archivePath.match(/archived-(.+)\.yaml/);
      expect(timestampMatch).toBeTruthy();
    });

    it('should preserve original content in archive', async () => {
      const originalContent = yaml.dump(testState);
      mockDirectoryManager.readFile = mock(() => Promise.resolve(originalContent));

      await stateSaver.archiveState();

      const writeCall = mockDirectoryManager.writeFile.mock.calls[0];
      expect(writeCall[1]).toBe(originalContent);
    });

    it('should handle archive errors gracefully', async () => {
      mockDirectoryManager.writeFile = mock(() =>
        Promise.reject(new Error('Archive failed'))
      );

      await expect(stateSaver.archiveState()).rejects.toThrow('Archive failed');
      expect(mockDirectoryManager.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent save operations', async () => {
      const saves = [
        stateSaver.saveState(testState),
        stateSaver.saveState(testState),
        stateSaver.saveState(testState),
      ];

      await Promise.all(saves);

      expect(mockConcurrencyManager.withLock).toHaveBeenCalledTimes(3);
    });

    it('should handle malformed state gracefully', async () => {
      const malformedState = {
        ...testState,
        checklists: 'not-an-array', // Invalid type
      } as any;

      mockValidator.validateState = mock(() => ({
        isValid: false,
        errors: ['checklists must be an array'],
      }));

      await expect(stateSaver.saveState(malformedState)).rejects.toThrow(StateError);
    });

    it('should handle file system errors during backup', async () => {
      mockBackupManager.createBackup = mock(() =>
        Promise.reject(new Error('Backup failed'))
      );

      await expect(stateSaver.saveState(testState)).rejects.toThrow('Backup failed');
      expect(mockTransactionCoordinator.rollbackTransaction).toHaveBeenCalled();
    });

    it('should handle encryption errors', async () => {
      mockFieldEncryption.encryptSensitiveFields = mock(() =>
        Promise.reject(new Error('Encryption failed'))
      );

      await expect(stateSaver.saveState(testState)).rejects.toThrow('Encryption failed');
      expect(mockTransactionCoordinator.rollbackTransaction).toHaveBeenCalled();
    });

    it('should handle large state files', async () => {
      const largeState = {
        ...testState,
        checklists: Array.from({ length: 1000 }, (_, i) => ({
          id: `checklist-${i}`,
          name: `Checklist ${i}`,
          items: Array.from({ length: 100 }, (_, j) => ({
            id: `item-${j}`,
            text: `Item ${j}`,
            completed: false,
          })),
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        })),
      };

      await stateSaver.saveState(largeState);

      expect(mockDirectoryManager.writeFile).toHaveBeenCalled();
    });
  });
});