import * as yaml from 'js-yaml';
import { createLogger } from '../../utils/logger';
import { BackupManager } from '../BackupManager';
import { ConcurrencyManager } from '../ConcurrencyManager';
import { DirectoryManager } from '../DirectoryManager';
import { FieldEncryption } from '../FieldEncryption';
import { SecretsDetector } from '../SecretsDetector';
import { SecurityAudit } from '../SecurityAudit';
import { TransactionCoordinator } from '../TransactionCoordinator';
import { StateError } from '../errors';
import { ChecklistState } from '../types';
import { StateValidator, ValidationResult } from '../validation';

export interface StateSaverDependencies {
  directoryManager: DirectoryManager;
  concurrencyManager: ConcurrencyManager;
  transactionCoordinator: TransactionCoordinator;
  validator: StateValidator;
  backupManager: BackupManager;
}

export class StateSaver {
  private logger = createLogger('checklist:state:saver');
  private fieldEncryption = new FieldEncryption();
  private secretsDetector = new SecretsDetector();
  private securityAudit = new SecurityAudit();

  private directoryManager: DirectoryManager;
  private concurrencyManager: ConcurrencyManager;
  private transactionCoordinator: TransactionCoordinator;
  private validator: StateValidator;
  private backupManager: BackupManager;

  constructor(dependencies: StateSaverDependencies) {
    this.directoryManager = dependencies.directoryManager;
    this.concurrencyManager = dependencies.concurrencyManager;
    this.transactionCoordinator = dependencies.transactionCoordinator;
    this.validator = dependencies.validator;
    this.backupManager = dependencies.backupManager;
  }

  async saveState(state: ChecklistState): Promise<void> {
    await this.concurrencyManager.withLock(async () => {
      const transactionId = await this.transactionCoordinator.beginTransaction();

      try {
        await this.performSave(state);
        await this.transactionCoordinator.commitTransaction(transactionId);
      } catch (error) {
        await this.transactionCoordinator.rollbackTransaction(transactionId);
        throw error;
      }
    });
  }

  private async performSave(state: ChecklistState): Promise<void> {
    this.validateStateBeforeSave(state);
    await this.performSecurityChecks(state);

    const processedState = await this.processStateForSave(state);
    await this.createBackupBeforeSave();
    await this.writeStateToFile(processedState);

    this.logger.info('State saved successfully', {
      itemCount: state.items.length,
      version: state.version,
    });
  }

  private validateStateBeforeSave(state: ChecklistState): void {
    const validation: ValidationResult = this.validator.validateState(state);
    if (validation.isValid !== true) {
      throw new StateError(`Invalid state: ${validation.errors.join(', ')}`);
    }
  }

  private async performSecurityChecks(state: ChecklistState): Promise<void> {
    const yamlContent = yaml.dump(state);
    const secrets = await this.secretsDetector.detectSecrets(yamlContent);

    if (secrets.length > 0) {
      this.logger.warn('Potential secrets detected in state', {
        secretCount: secrets.length,
      });
    }

    await this.securityAudit.auditState(state);
  }

  private async processStateForSave(state: ChecklistState): Promise<ChecklistState> {
    // Update metadata
    const processedState: ChecklistState = {
      ...state,
      metadata: {
        ...state.metadata,
        modified: new Date().toISOString(),
      },
    };

    // Encrypt sensitive fields
    return await this.fieldEncryption.encryptSensitiveFields(processedState);
  }

  private async createBackupBeforeSave(): Promise<void> {
    const statePath = this.directoryManager.getStatePath();
    const fileExists = await this.directoryManager.fileExists(statePath);
    if (fileExists === true) {
      await this.backupManager.createBackup(statePath);
    }
  }

  private async writeStateToFile(state: ChecklistState): Promise<void> {
    const yamlContent = yaml.dump(state, {
      indent: 2,
      lineWidth: -1,
      sortKeys: false,
    });

    const statePath = this.directoryManager.getStatePath();
    await this.directoryManager.writeFile(statePath, yamlContent);
  }

  async exportState(state: ChecklistState): Promise<string> {
    this.validateStateBeforeSave(state);

    // Don't encrypt for export
    const exportState: ChecklistState = {
      ...state,
      metadata: {
        ...state.metadata,
        exported: new Date().toISOString(),
      },
    };

    return yaml.dump(exportState, {
      indent: 2,
      lineWidth: -1,
      sortKeys: false,
    });
  }

  async archiveState(): Promise<void> {
    await this.concurrencyManager.withLock(async () => {
      const statePath = this.directoryManager.getStatePath();

      const fileExists = await this.directoryManager.fileExists(statePath);
      if (fileExists !== true) {
        this.logger.info('No state file to archive');
        return;
      }

      await this.createArchiveBackup(statePath);
      await this.removeCurrentState(statePath);

      this.logger.info('State archived successfully');
    });
  }

  private async createArchiveBackup(statePath: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveName = `archived-${timestamp}.yaml`;
    const archivePath = this.directoryManager.getArchivePath(archiveName);

    const content = await this.directoryManager.readFile(statePath);
    await this.directoryManager.writeFile(archivePath, content);

    this.logger.info('State archived', { archivePath });
  }

  private async removeCurrentState(statePath: string): Promise<void> {
    await this.directoryManager.deleteFile(statePath);
  }
}