import * as yaml from 'js-yaml';
import { createLogger } from '../../utils/logger';
import { DirectoryManager } from '../DirectoryManager';
import { SCHEMA_VERSION } from '../constants';
import { StateError, StateCorruptedError } from '../errors';
import { MigrationRunner } from '../migrations/MigrationRunner';
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
      this.logger.info('Initializing state system');

      await this.directoryManager.ensureDirectoriesExist();
      const statePath = this.directoryManager.getStatePath();

      if ((await this.directoryManager.fileExists(statePath)) === true) {
        return await this.loadExistingState(statePath);
      } else {
        return await this.createNewState(statePath);
      }
    } catch (error) {
      this.logger.error('Failed to initialize state', { error });
      throw new StateError(`Failed to initialize state: ${(error as Error).message}`);
    }
  }

  private async loadExistingState(statePath: string): Promise<ChecklistState> {
    this.logger.info('Loading existing state from disk');
    const content = await this.directoryManager.readFile(statePath);
    const parsed = yaml.load(content) as ChecklistState;

    const validation = this.validator.validateState(parsed);
    if (validation.isValid !== true) {
      throw new StateCorruptedError(`Invalid state: ${validation.errors.join(', ')}`);
    }

    return await this.handleMigrationIfNeeded(parsed, statePath);
  }

  private async handleMigrationIfNeeded(
    state: ChecklistState,
    statePath: string
  ): Promise<ChecklistState> {
    if (state.version !== SCHEMA_VERSION) {
      this.logger.info('State migration required', {
        currentVersion: state.version,
        targetVersion: SCHEMA_VERSION,
      });

      return await this.migrationRunner.migrateState(statePath);
    }
    return state;
  }

  private async createNewState(statePath: string): Promise<ChecklistState> {
    this.logger.info('Creating new state file');
    const newState = this.createEmptyState();
    await this.saveNewState(newState, statePath);
    return newState;
  }

  private createEmptyState(): ChecklistState {
    return {
      version: SCHEMA_VERSION,
      metadata: {
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        template: 'default',
      },
      items: [],
    };
  }

  private async saveNewState(state: ChecklistState, statePath: string): Promise<void> {
    const yamlContent = yaml.dump(state, {
      indent: 2,
      lineWidth: -1,
      sortKeys: false,
    });

    await this.directoryManager.writeFile(statePath, yamlContent);
    this.logger.info('New state file created successfully');
  }
}