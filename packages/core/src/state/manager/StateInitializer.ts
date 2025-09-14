import * as yaml from 'js-yaml';
import { createLogger } from '../../utils/logger';
import { DirectoryManager } from '../DirectoryManager';
import { SCHEMA_VERSION } from '../constants';
import { StateError, StateCorruptedError } from '../errors';
import { MigrationRunner } from '../migrations/MigrationRunner';
import { StateSchema } from '../migrations/types';
import { ChecklistState } from '../types';
import { StateValidator } from '../validation';

export class StateInitializer {
  private logger = createLogger('checklist:state:initializer');

  constructor(
    private directoryManager: DirectoryManager,
    private validator: StateValidator,
    private migrationRunner: MigrationRunner
  ) {}

  async initializeState(): Promise<ChecklistState> {
    try {
      this.logger.info({ msg: 'Initializing state system' });

      await this.directoryManager.ensureDirectoriesExist();
      const statePath = this.directoryManager.getStatePath();

      if ((await this.directoryManager.fileExists(statePath)) === true) {
        return await this.loadExistingState(statePath);
      } else {
        return await this.createNewState(statePath);
      }
    } catch (error) {
      this.logger.error({ msg: 'Failed to initialize state', error });
      throw new StateError(
        `Failed to initialize state: ${(error as Error).message}`,
        'INIT_FAILED'
      );
    }
  }

  private async loadExistingState(statePath: string): Promise<ChecklistState> {
    this.logger.info({ msg: 'Loading existing state from disk' });
    const content = await this.directoryManager.readFile(statePath);
    const parsed = yaml.load(content) as ChecklistState;

    const validation = this.validator.validateState(parsed);
    if (validation.isValid !== true) {
      throw new StateCorruptedError(
        `Invalid state: ${validation.errors.join(', ')}`,
        'schema_invalid'
      );
    }

    return await this.handleMigrationIfNeeded(parsed, statePath);
  }

  private async handleMigrationIfNeeded(
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

  private async createNewState(statePath: string): Promise<ChecklistState> {
    this.logger.info({ msg: 'Creating new state file' });
    const newState = this.createEmptyState();
    await this.saveNewState(newState, statePath);
    return newState;
  }

  private createEmptyState(): ChecklistState {
    return {
      version: SCHEMA_VERSION,
      schemaVersion: SCHEMA_VERSION,
      checksum: '',
      completedSteps: [],
      recovery: {
        dataLoss: false,
      },
      conflicts: {},
      metadata: {
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        template: 'default',
      },
    };
  }

  private async saveNewState(
    state: ChecklistState,
    statePath: string
  ): Promise<void> {
    const yamlContent = yaml.dump(state, {
      indent: 2,
      lineWidth: -1,
      sortKeys: false,
    });

    await this.directoryManager.writeFile(statePath, yamlContent);
    this.logger.info({ msg: 'New state file created successfully' });
  }
}
