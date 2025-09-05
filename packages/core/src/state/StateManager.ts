import { join } from 'node:path';
import * as yaml from 'js-yaml';
import { ChecklistState } from './types';
import { DirectoryManager } from './DirectoryManager';
import { ConcurrencyManager } from './ConcurrencyManager';
import { TransactionCoordinator } from './TransactionCoordinator';
import { StateValidator } from './validation';
import { BackupManager } from './BackupManager';
import { StateError, StateCorruptedError, RecoveryError } from './errors';
import { SCHEMA_VERSION } from './constants';

export class StateManager {
  private directoryManager: DirectoryManager;
  private concurrencyManager: ConcurrencyManager;
  private transactionCoordinator: TransactionCoordinator;
  private validator: StateValidator;
  private backupManager: BackupManager;
  private currentState?: ChecklistState;
  private baseDir: string;

  constructor(baseDir: string = '.checklist') {
    this.baseDir = baseDir;
    this.directoryManager = new DirectoryManager(baseDir);
    this.concurrencyManager = new ConcurrencyManager(this.directoryManager.getLockPath());
    this.transactionCoordinator = new TransactionCoordinator(this.directoryManager.getLogPath());
    this.validator = new StateValidator();
    this.backupManager = new BackupManager(this.directoryManager.getBackupPath());
  }

  async initializeState(): Promise<ChecklistState> {
    await this.concurrencyManager.acquireLock('state');

    try {
      await this.directoryManager.initialize();

      const initialState: ChecklistState = {
        schemaVersion: SCHEMA_VERSION,
        checksum: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        completedSteps: [],
        recovery: {
          dataLoss: false,
        },
        conflicts: {},
      };

      const checksum = this.validator.calculateChecksum(initialState);
      initialState.checksum = checksum;

      await this.saveStateInternal(initialState);

      await this.backupManager.initializeManifest();

      this.currentState = initialState;
      return initialState;
    } finally {
      await this.concurrencyManager.releaseLock('state');
    }
  }

  async loadState(): Promise<ChecklistState> {
    await this.concurrencyManager.acquireLock('state', 10000);

    try {
      const statePath = this.directoryManager.getStatePath();
      const stateFile = Bun.file(statePath);

      if (!(await stateFile.exists())) {
        return await this.initializeState();
      }

      const content = await stateFile.text();
      let state: unknown;

      try {
        state = yaml.load(content);
      } catch (error) {
        throw new StateCorruptedError(`Failed to parse state file: ${error}`, 'parse_error');
      }

      try {
        const validatedState = await this.validator.validate(state);

        if (
          !this.validator.isValidSchemaVersion(validatedState.schemaVersion, [
            SCHEMA_VERSION,
            '0.9.0',
          ])
        ) {
          if (this.validator.canMigrate(validatedState.schemaVersion, SCHEMA_VERSION)) {
            return await this.migrateState(validatedState);
          } else {
            throw new StateError(
              `Unsupported schema version: ${validatedState.schemaVersion}`,
              'SCHEMA_VERSION_MISMATCH'
            );
          }
        }

        this.currentState = validatedState;
        return validatedState;
      } catch (error) {
        if (error instanceof StateCorruptedError) {
          return await this.handleCorruptedState(error);
        }
        throw error;
      }
    } finally {
      await this.concurrencyManager.releaseLock('state');
    }
  }

  async saveState(state: ChecklistState): Promise<void> {
    await this.concurrencyManager.acquireLock('state');
    const transactionId = await this.transactionCoordinator.beginTransaction(
      this.currentState || state
    );

    try {
      await this.transactionCoordinator.addOperation(transactionId, 'SAVE', '/', state);

      const isValid = await this.transactionCoordinator.validateTransaction(
        transactionId,
        async () => {
          try {
            await this.validator.validate(state);
            return true;
          } catch {
            return false;
          }
        }
      );

      if (!isValid) {
        throw new StateError('State validation failed', 'VALIDATION_FAILED');
      }

      await this.transactionCoordinator.commitTransaction(transactionId, async () => {
        const checksum = this.validator.calculateChecksum(state);
        state.checksum = checksum;

        await this.saveStateInternal(state);
        await this.backupManager.createBackup(state);

        this.currentState = state;
        return state;
      });
    } catch (error) {
      await this.transactionCoordinator.rollbackTransaction(transactionId);
      throw error;
    } finally {
      await this.concurrencyManager.releaseLock('state');
    }
  }

  private async saveStateInternal(state: ChecklistState): Promise<void> {
    const statePath = this.directoryManager.getStatePath();
    const tempPath = `${statePath}.tmp`;

    const content = yaml.dump(state, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: true,
    });

    await Bun.write(tempPath, content);

    const tempFile = Bun.file(tempPath);
    const writtenContent = await tempFile.text();
    const writtenState = yaml.load(writtenContent) as ChecklistState;

    if (writtenState.checksum !== state.checksum) {
      await tempFile.unlink();
      throw new StateError('State write verification failed', 'WRITE_FAILED');
    }

    const stateFile = Bun.file(statePath);
    if (await stateFile.exists()) {
      await stateFile.unlink();
    }

    await Bun.write(statePath, content);
  }

  async updateState(
    updater: (state: ChecklistState) => ChecklistState | Promise<ChecklistState>
  ): Promise<ChecklistState> {
    const currentState = this.currentState || (await this.loadState());
    const updatedState = await updater(structuredClone(currentState));
    await this.saveState(updatedState);
    return updatedState;
  }

  async archiveState(): Promise<void> {
    await this.concurrencyManager.acquireLock('state');

    try {
      if (!this.currentState) {
        throw new StateError('No state to archive', 'NO_STATE');
      }

      const archivePath = join(this.directoryManager.getBackupPath(), `archive-${Date.now()}.yaml`);

      const content = yaml.dump(this.currentState, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: true,
      });

      await Bun.write(archivePath, content);

      await this.initializeState();
    } finally {
      await this.concurrencyManager.releaseLock('state');
    }
  }

  private async handleCorruptedState(error: StateCorruptedError): Promise<ChecklistState> {
    console.error('State corruption detected:', error.message);

    try {
      const recoveredState = await this.backupManager.recoverFromLatestBackup();

      recoveredState.recovery = {
        lastCorruption: new Date().toISOString(),
        corruptionType: error.corruptionType,
        recoveryMethod: 'backup',
        dataLoss: false,
      };

      await this.saveStateInternal(recoveredState);
      this.currentState = recoveredState;

      return recoveredState;
    } catch (backupError) {
      console.error('Backup recovery failed:', backupError);

      const shouldReset = await this.promptUserForReset();
      if (shouldReset) {
        const freshState = await this.initializeState();
        freshState.recovery = {
          lastCorruption: new Date().toISOString(),
          corruptionType: error.corruptionType,
          recoveryMethod: 'reset',
          dataLoss: true,
        };

        await this.saveStateInternal(freshState);
        return freshState;
      }

      throw new RecoveryError('Failed to recover from corrupted state', true);
    }
  }

  private async migrateState(oldState: ChecklistState): Promise<ChecklistState> {
    console.log(`Migrating state from ${oldState.schemaVersion} to ${SCHEMA_VERSION}`);

    const migratedState: ChecklistState = {
      ...oldState,
      schemaVersion: SCHEMA_VERSION,
    };

    const checksum = this.validator.calculateChecksum(migratedState);
    migratedState.checksum = checksum;

    await this.saveStateInternal(migratedState);
    this.currentState = migratedState;

    return migratedState;
  }

  private async promptUserForReset(): Promise<boolean> {
    return true;
  }

  async exportState(): Promise<string> {
    const state = this.currentState || (await this.loadState());
    return yaml.dump(state, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: true,
    });
  }

  async importState(yamlContent: string): Promise<ChecklistState> {
    await this.concurrencyManager.acquireLock('state');

    try {
      const importedState = yaml.load(yamlContent) as unknown;
      const validatedState = await this.validator.validate(importedState);

      await this.backupManager.createBackup(this.currentState || validatedState);

      await this.saveStateInternal(validatedState);
      this.currentState = validatedState;

      return validatedState;
    } finally {
      await this.concurrencyManager.releaseLock('state');
    }
  }

  getCurrentState(): ChecklistState | undefined {
    return this.currentState;
  }

  async cleanup(): Promise<void> {
    await this.transactionCoordinator.cleanup();
    await this.concurrencyManager.releaseLock();
  }
}
