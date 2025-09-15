import { EventEmitter } from 'events';
import * as yaml from 'js-yaml';
import { createLogger } from '../../utils/logger';
import { BackupManager } from './BackupManager';
import { MigrationExecutor } from './MigrationExecutor';
import { MigrationRecordKeeper } from './MigrationRecordKeeper';
import { MigrationRegistry } from './MigrationRegistry';
import { MigrationUtils } from './MigrationUtils';
import { MigrationValidator } from './MigrationValidator';
import {
  BackupInfo,
  Migration,
  MigrationOptions,
  MigrationResult,
  StateSchema,
} from './types';

const logger = createLogger('checklist:migration');

interface MigrationContext {
  earlyReturn?: MigrationResult;
  state?: StateSchema;
  fromVersion?: string;
  toVersion?: string;
  migrationPath?: { migrations: Migration[]; totalSteps: number };
  statePath?: string;
}

export class MigrationRunner extends EventEmitter {
  private registry: MigrationRegistry;
  private validator: MigrationValidator;
  private executor: MigrationExecutor;
  private recordKeeper: MigrationRecordKeeper;
  private backupManager: BackupManager;
  private currentVersion: string;

  constructor(
    registry: MigrationRegistry,
    backupDir: string = '.checklist/.backup',
    currentVersion: string = '1.0.0'
  ) {
    super();
    this.registry = registry;
    this.currentVersion = currentVersion;

    // Initialize composed services
    this.validator = new MigrationValidator(registry);
    this.recordKeeper = new MigrationRecordKeeper();
    this.backupManager = new BackupManager(backupDir);
    this.executor = new MigrationExecutor(
      this.validator,
      this.recordKeeper,
      this.backupManager
    );

    // Forward events from executor
    this.executor.on('progress', (progress) => {
      this.emit('progress', progress);
      this.emit('migration:progress', progress);
    });
    this.executor.on('error', (errorInfo) => {
      this.emit('error', errorInfo);
      this.emit('migration:error', errorInfo);
    });
  }

  async migrate(
    statePath: string,
    targetVersion?: string,
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    try {
      const context = await this.prepareMigrationContext(
        statePath,
        options,
        targetVersion
      );

      if (context.earlyReturn) {
        return context.earlyReturn;
      }

      return await this.executeMigrationPlan(context, options);
    } catch (error) {
      return MigrationUtils.createErrorResult(error, targetVersion);
    }
  }

  // Public API methods - delegate to specialized services
  async createBackup(statePath: string, version: string): Promise<string> {
    return this.backupManager.createBackup(statePath, version);
  }

  async listBackups(): Promise<BackupInfo[]> {
    return this.backupManager.listBackups();
  }

  async rollback(statePath: string, backupPath: string): Promise<void> {
    this.emit('rollback:start');
    await this.backupManager.rollback(statePath, backupPath);
    this.emit('rollback:complete');
  }

  // Private implementation methods
  private async prepareMigrationContext(
    statePath: string,
    options: MigrationOptions,
    targetVersion?: string
  ): Promise<MigrationContext> {
    const { dryRun = false, verbose = false } = options;
    const state = await this.loadState(statePath);
    const { fromVersion, toVersion } = this.getVersions(state, targetVersion);

    const earlyResult = this.checkForEarlyReturn(
      fromVersion,
      toVersion,
      verbose
    );
    if (earlyResult) {
      return { earlyReturn: earlyResult };
    }

    const migrationPath = await this.validator.validateMigrationPath(
      fromVersion,
      toVersion
    );

    return this.buildFinalContext({
      migrationPath,
      fromVersion,
      toVersion,
      dryRun,
      verbose,
      state,
      statePath,
    });
  }

  private async executeMigrationPlan(
    context: MigrationContext,
    options: MigrationOptions
  ): Promise<MigrationResult> {
    const { createBackup = true, verbose = false } = options;

    this.validateContext(context);

    const { state, fromVersion, toVersion, migrationPath, statePath } = context;

    // Context is validated, so these are guaranteed to be defined
    // Only create backup if state file exists
    let backupPath: string | undefined;
    if (createBackup) {
      const file = Bun.file(statePath as string);
      if (await file.exists()) {
        backupPath = await this.backupManager.createBackup(
          statePath as string,
          fromVersion as string
        );
      }
    }

    try {
      const appliedMigrations = await this.executor.executeMigrations(
        migrationPath as { migrations: Migration[]; totalSteps: number },
        state as StateSchema,
        statePath as string,
        { createBackup, backupPath, verbose }
      );

      MigrationUtils.logSuccess(
        appliedMigrations.length,
        toVersion as string,
        verbose
      );

      return {
        success: true,
        fromVersion: fromVersion as string,
        toVersion: toVersion as string,
        appliedMigrations,
        backupPath,
      };
    } catch (error) {
      // Emit migration error event
      this.emit('migration:error', {
        error: error as Error,
        fromVersion: fromVersion as string,
        toVersion: toVersion as string,
      });

      // Rollback on failure
      if (backupPath !== null && backupPath !== undefined) {
        try {
          this.emit('rollback:start');
          await this.backupManager.rollback(statePath as string, backupPath);
          this.emit('rollback:complete');
        } catch (rollbackError) {
          logger.error({
            msg: 'Rollback failed during migration failure',
            error: rollbackError,
          });
        }
      }

      return {
        success: false,
        fromVersion: fromVersion as string,
        toVersion: toVersion as string,
        appliedMigrations: [],
        error: error as Error,
        backupPath,
      };
    }
  }

  private checkForEarlyReturn(
    fromVersion: string,
    toVersion: string,
    verbose: boolean
  ): MigrationResult | null {
    if (fromVersion === toVersion) {
      return MigrationUtils.noMigrationsResult(fromVersion, toVersion, verbose);
    }
    return null;
  }

  private buildFinalContext(params: {
    migrationPath: { migrations: Migration[]; totalSteps: number };
    fromVersion: string;
    toVersion: string;
    dryRun: boolean;
    verbose: boolean;
    state: StateSchema;
    statePath: string;
  }): MigrationContext {
    const {
      migrationPath,
      fromVersion,
      toVersion,
      dryRun,
      verbose,
      state,
      statePath,
    } = params;

    if (migrationPath.migrations.length === 0) {
      return {
        earlyReturn: MigrationUtils.noMigrationsResult(
          fromVersion,
          toVersion,
          verbose
        ),
      };
    }

    MigrationUtils.logMigrationPlan(
      migrationPath,
      fromVersion,
      toVersion,
      verbose
    );

    if (dryRun) {
      return {
        earlyReturn: MigrationUtils.dryRunResult(
          migrationPath,
          fromVersion,
          toVersion
        ),
      };
    }

    return { state, fromVersion, toVersion, migrationPath, statePath };
  }

  private validateContext(context: MigrationContext): void {
    const { state, fromVersion, toVersion, migrationPath, statePath } = context;

    if (
      state === undefined ||
      fromVersion === undefined ||
      toVersion === undefined ||
      migrationPath === undefined ||
      statePath === undefined
    ) {
      throw new Error('Invalid migration context');
    }
  }

  private getVersions(
    state: StateSchema,
    targetVersion?: string
  ): { fromVersion: string; toVersion: string } {
    const fromVersion = (state.version as string) ?? '0.0.0';
    const toVersion = targetVersion ?? this.currentVersion;
    return { fromVersion, toVersion };
  }

  private async loadState(statePath: string): Promise<StateSchema> {
    try {
      const file = Bun.file(statePath);
      if (!(await file.exists())) {
        // Create initial state when file doesn't exist
        logger.info({
          msg: 'State file not found, creating initial state',
          path: statePath,
        });
        return this.createInitialState();
      }

      const content = await file.text();
      const state = yaml.load(content) as StateSchema;

      if (state === null || state === undefined || typeof state !== 'object') {
        throw new Error('Invalid state file format');
      }

      return state;
    } catch (error) {
      logger.error({ msg: 'Failed to load state', error, path: statePath });
      throw error;
    }
  }

  private createInitialState(): StateSchema {
    return {
      version: '0.0.0',
      schemaVersion: '0.0.0',
      checklists: [],
      lastModified: new Date().toISOString(),
    };
  }

  // Additional methods required by tests
  setMaxBackups(maxBackups: number): void {
    this.backupManager.setMaxBackups(maxBackups);
  }

  async restoreFromBackup(backupPath: string): Promise<StateSchema> {
    return await this.backupManager.restoreBackup(backupPath);
  }

  async migrateState(
    state: StateSchema,
    fromVersion: string,
    toVersion: string
  ): Promise<StateSchema> {
    const migrationPath = this.registry.getMigrationPath(
      fromVersion,
      toVersion
    );

    if (migrationPath.migrations.length === 0) {
      return state;
    }

    let currentState = state;
    for (const migration of migrationPath.migrations) {
      // Use the 'up' function to migrate forward
      if (migration.up == null) {
        throw new Error(`Migration function 'up' not found for ${migration.fromVersion} -> ${migration.toVersion}`);
      }
      currentState = migration.up(currentState) as StateSchema;
    }

    return currentState;
  }
}
