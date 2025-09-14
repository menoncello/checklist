import * as yaml from 'js-yaml';
import { createLogger } from '../../utils/logger';
import { DirectoryManager } from '../DirectoryManager';
import { SCHEMA_VERSION } from '../constants';
import { StateCorruptedError, RecoveryError } from '../errors';
import { MigrationRunner } from '../migrations/MigrationRunner';
import { StateSchema } from '../migrations/types';
import { ChecklistState } from '../types';
import { StateValidator } from '../validation';

export class StateLoader {
  private logger = createLogger('checklist:state:loader');

  constructor(
    private directoryManager: DirectoryManager,
    private validator: StateValidator,
    private migrationRunner: MigrationRunner
  ) {}

  async loadState(): Promise<ChecklistState> {
    const statePath = this.directoryManager.getStatePath();

    if ((await this.directoryManager.fileExists(statePath)) !== true) {
      throw new StateCorruptedError('State file does not exist', 'parse_error');
    }

    try {
      return await this.loadAndValidateState(statePath);
    } catch (error) {
      this.logger.error({
        msg: 'Failed to load state, attempting recovery',
        error,
      });
      return await this.attemptRecovery(statePath, error as Error);
    }
  }

  private async loadAndValidateState(
    statePath: string
  ): Promise<ChecklistState> {
    const content = await this.directoryManager.readFile(statePath);
    const parsed = this.parseYamlContent(content);
    this.validateStateStructure(parsed);
    return await this.handleVersionMigration(parsed, statePath);
  }

  private parseYamlContent(content: string): ChecklistState {
    try {
      return yaml.load(content) as ChecklistState;
    } catch (error) {
      throw new StateCorruptedError(
        `Failed to parse YAML: ${(error as Error).message}`,
        'parse_error'
      );
    }
  }

  private validateStateStructure(state: ChecklistState): void {
    const validation = this.validator.validateState(state);
    if (validation.isValid !== true) {
      throw new StateCorruptedError(
        `Invalid state structure: ${validation.errors.join(', ')}`,
        'schema_invalid'
      );
    }
  }

  private async handleVersionMigration(
    state: ChecklistState,
    _statePath: string
  ): Promise<ChecklistState> {
    if (state.version !== SCHEMA_VERSION) {
      this.logger.info({
        msg: 'State migration required',
        currentVersion: state.version,
        targetVersion: SCHEMA_VERSION,
      });
      const migrated = await this.migrationRunner.migrateState(
        state as unknown as StateSchema,
        state.version ?? '1.0.0',
        SCHEMA_VERSION
      );
      return migrated as unknown as ChecklistState;
    }
    return state;
  }

  private async attemptRecovery(
    statePath: string,
    originalError: Error
  ): Promise<ChecklistState> {
    const backupPaths = await this.findRecoveryBackups();

    for (const backupPath of backupPaths) {
      try {
        this.logger.info({
          msg: 'Attempting recovery from backup',
          backupPath,
        });
        const state = await this.loadFromBackup(backupPath);
        await this.restoreFromBackup(state, statePath);
        return state;
      } catch (recoveryError) {
        this.logger.warn({
          msg: 'Recovery attempt failed',
          backupPath,
          recoveryError,
        });
        continue;
      }
    }

    throw new RecoveryError(`Recovery failed: ${originalError.message}`);
  }

  private async findRecoveryBackups(): Promise<string[]> {
    const backupDir = this.directoryManager.getBackupPath();
    const backupFiles = await this.directoryManager.listFiles(backupDir);

    return backupFiles
      .filter((file) => file.endsWith('.backup.yaml'))
      .sort((a, b) => b.localeCompare(a)) // Most recent first
      .slice(0, 3); // Try up to 3 most recent backups
  }

  private async loadFromBackup(backupPath: string): Promise<ChecklistState> {
    const content = await this.directoryManager.readFile(backupPath);
    const state = yaml.load(content) as ChecklistState;
    this.validateStateStructure(state);
    return state;
  }

  private async restoreFromBackup(
    state: ChecklistState,
    statePath: string
  ): Promise<void> {
    const yamlContent = yaml.dump(state, {
      indent: 2,
      lineWidth: -1,
      sortKeys: false,
    });

    await this.directoryManager.writeFile(statePath, yamlContent);
    this.logger.info({ msg: 'State restored from backup successfully' });
  }

  async importState(yamlContent: string): Promise<ChecklistState> {
    const parsed = this.parseYamlContent(yamlContent);
    this.validateStateStructure(parsed);

    // Ensure imported state has correct version
    parsed.version = SCHEMA_VERSION;
    if (parsed.metadata) {
      parsed.metadata.modified = new Date().toISOString();
    }

    return parsed;
  }
}
