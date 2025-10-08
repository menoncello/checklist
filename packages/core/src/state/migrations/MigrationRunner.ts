import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger';
import { BackupManager } from './BackupManager';
import { MigrationBackupHandler } from './MigrationBackupHandler';
import { MigrationExecutor } from './MigrationExecutor';
import { MigrationRecordKeeper } from './MigrationRecordKeeper';
import { MigrationRegistry } from './MigrationRegistry';
import {
  MigrationRunnerHelpers,
  MigrationExecutionConfig,
} from './MigrationRunnerHelpers';
import { MigrationValidator } from './MigrationValidator';
import { StateMigrationHandler } from './StateMigrationHandler';
import {
  BackupInfo,
  Migration,
  MigrationOptions,
  MigrationResult,
  StateSchema,
  MigrationContext,
} from './types';
const logger = createLogger('checklist:migration');
function isEarlyReturn(
  context: unknown
): context is { earlyReturn: MigrationResult } {
  return (
    context !== null &&
    context !== undefined &&
    typeof context === 'object' &&
    'earlyReturn' in context &&
    context.earlyReturn !== undefined
  );
}
export class MigrationRunner extends EventEmitter {
  private registry: MigrationRegistry;
  private validator: MigrationValidator;
  private executor: MigrationExecutor;
  private recordKeeper: MigrationRecordKeeper;
  private backupManager: BackupManager;
  private backupHandler: MigrationBackupHandler;
  private stateMigrationHandler: StateMigrationHandler;
  private currentVersion: string;
  constructor(
    registry: MigrationRegistry,
    backupDir: string = '.checklist/.backup',
    currentVersion: string = '1.0.0'
  ) {
    super();
    if (backupDir.includes('..') || backupDir.includes('~')) {
      throw new Error('Invalid backup directory path');
    }
    this.registry = registry;
    this.currentVersion = currentVersion;
    this.stateMigrationHandler = new StateMigrationHandler(registry);
    this.validator = new MigrationValidator(registry);
    this.recordKeeper = new MigrationRecordKeeper();
    this.backupManager = new BackupManager(backupDir);
    this.backupHandler = new MigrationBackupHandler(this.backupManager);
    this.executor = new MigrationExecutor(
      this.validator,
      this.recordKeeper,
      this.backupManager
    );
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
      const context = await this.prepareMigration(
        statePath,
        targetVersion,
        options
      );
      return this.handleMigrationContext(context, targetVersion, options);
    } catch (error) {
      return this.createErrorResult(error, targetVersion);
    }
  }
  private handleMigrationContext(
    context: { earlyReturn?: MigrationResult } | MigrationContext,
    targetVersion: string | undefined,
    options: MigrationOptions
  ): Promise<MigrationResult> | MigrationResult {
    if (isEarlyReturn(context)) {
      return context.earlyReturn ?? this.createEarlyReturnError();
    }
    return this.runMigrations(context as MigrationContext, options);
  }
  private createEarlyReturnError(): MigrationResult {
    return {
      success: false,
      fromVersion: '',
      toVersion: '',
      error: new Error('Early return without result'),
      appliedMigrations: [],
    };
  }
  private createErrorResult(
    error: unknown,
    targetVersion: string | undefined
  ): MigrationResult {
    return {
      success: false,
      fromVersion: '',
      toVersion: targetVersion ?? this.currentVersion,
      error: error instanceof Error ? error : new Error(String(error)),
      appliedMigrations: [],
    };
  }
  private async prepareMigration(
    statePath: string,
    targetVersion: string | undefined,
    options: MigrationOptions
  ): Promise<{ earlyReturn?: MigrationResult } | MigrationContext> {
    const { dryRun = false, verbose = false } = options;
    const state = await MigrationRunnerHelpers.loadState(statePath);
    const versionInfo = MigrationRunnerHelpers.getVersions(
      state,
      this.currentVersion,
      targetVersion
    );
    const earlyResult = MigrationRunnerHelpers.checkForEarlyReturn(
      versionInfo.fromVersion,
      versionInfo.toVersion
    );
    if (earlyResult !== null) return { earlyReturn: earlyResult };
    const migrationPath = (await this.validator.validateMigrationPath(
      versionInfo.fromVersion,
      versionInfo.toVersion
    )) as { migrations: Migration[]; totalSteps: number };
    return this.buildMigrationContext({
      migrationPath,
      versionInfo,
      dryRun,
      verbose,
      state,
      statePath,
    });
  }
  private buildMigrationContext(params: {
    migrationPath: { migrations: Migration[]; totalSteps: number };
    versionInfo: { fromVersion: string; toVersion: string };
    dryRun: boolean;
    verbose: boolean;
    state: StateSchema;
    statePath: string;
  }): { earlyReturn?: MigrationResult } | MigrationContext {
    const context = MigrationRunnerHelpers.buildFinalContext({
      migrationPath: params.migrationPath,
      fromVersion: params.versionInfo.fromVersion,
      toVersion: params.versionInfo.toVersion,
      dryRun: params.dryRun,
      verbose: params.verbose,
      state: params.state,
      statePath: params.statePath,
    });
    if (isEarlyReturn(context) && context.earlyReturn !== undefined)
      return { earlyReturn: context.earlyReturn };
    if (!isEarlyReturn(context)) {
      MigrationRunnerHelpers.validateContext(context);
    }
    return context;
  }
  async createBackup(statePath: string, version: string): Promise<string> {
    return this.backupHandler.createBackup(statePath, version);
  }
  async listBackups(): Promise<BackupInfo[]> {
    return this.backupHandler.listBackups();
  }
  async rollback(statePath: string, backupPath: string): Promise<void> {
    this.emit('rollback:start');
    await this.backupHandler.rollback(statePath, backupPath);
    this.emit('rollback:complete');
  }
  private async runMigrations(
    context: MigrationContext,
    options: MigrationOptions,
    backupPath?: string
  ): Promise<MigrationResult> {
    const finalBackupPath = await this.prepareBackup(
      backupPath,
      context,
      options
    );
    return await this.executeMigrationsSafely(
      context,
      options,
      finalBackupPath
    );
  }
  private async prepareBackup(
    backupPath: string | undefined,
    context: MigrationContext,
    options: MigrationOptions
  ): Promise<string | undefined> {
    const { createBackup = true } = options;
    return (
      backupPath ??
      (await MigrationRunnerHelpers.createBackupIfNeeded(
        createBackup,
        context.statePath,
        context.fromVersion,
        this.backupManager
      ))
    );
  }
  private async executeMigrationsSafely(
    context: MigrationContext,
    options: MigrationOptions,
    backupPath?: string
  ): Promise<MigrationResult> {
    try {
      const migrations = await this.runMigrationExecution(
        context,
        options,
        backupPath
      );
      return MigrationRunnerHelpers.buildSuccessResult(
        context.fromVersion,
        context.toVersion,
        migrations,
        backupPath
      );
    } catch (error) {
      await this.handleMigrationError(context, error as Error, backupPath);
      return MigrationRunnerHelpers.buildFailureResult(
        context.fromVersion,
        context.toVersion,
        error as Error,
        backupPath
      );
    }
  }
  private async runMigrationExecution(
    context: MigrationContext,
    options: MigrationOptions,
    backupPath?: string
  ): Promise<string[]> {
    const migrationConfig = new MigrationExecutionConfig(
      context.migrationPath,
      context.state,
      context.statePath,
      {
        createBackup: false,
        backupPath,
        verbose: options.verbose ?? false,
      }
    );
    return await MigrationRunnerHelpers.executeValidatedMigrations(
      migrationConfig,
      this.executor
    );
  }
  private async handleMigrationError(
    context: MigrationContext,
    error: Error,
    backupPath?: string
  ): Promise<void> {
    this.emit('migration:error', {
      error,
      fromVersion: context.fromVersion,
      toVersion: context.toVersion,
    });
    if (backupPath !== null && backupPath !== undefined) {
      try {
        this.emit('rollback:start');
        await MigrationRunnerHelpers.performRollback(
          context.statePath,
          backupPath,
          this.backupManager
        );
        this.emit('rollback:complete');
      } catch (rollbackError) {
        logger.error({
          msg: 'Rollback failed during migration failure',
          error: rollbackError,
        });
      }
    }
  }
  setMaxBackups(maxBackups: number): void {
    this.backupHandler.setMaxBackups(maxBackups);
  }
  async restoreFromBackup(backupPath: string): Promise<StateSchema> {
    return this.backupHandler.restoreFromBackup(backupPath);
  }
  async migrateState(
    state: StateSchema,
    fromVersion: string,
    toVersion: string
  ): Promise<StateSchema> {
    return this.stateMigrationHandler.migrateState(
      state,
      fromVersion,
      toVersion
    );
  }
}

export { MigrationRegistry } from './MigrationRegistry';
