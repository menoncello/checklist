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
    this.executor.on('progress', (progress) => this.emit('progress', progress));
    this.executor.on('error', (errorInfo) => this.emit('error', errorInfo));
  }

  async migrate(
    statePath: string,
    targetVersion?: string,
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    try {
      const context = await this.prepareMigrationContext(
        statePath,
        targetVersion,
        options
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
    await this.backupManager.rollback(statePath, backupPath);
  }

  // Private implementation methods
  private async prepareMigrationContext(
    statePath: string,
    targetVersion?: string,
    options: MigrationOptions
  ): Promise<MigrationContext> {
    const { dryRun = false, verbose = false } = options;
    const state = await this.loadState(statePath);
    const { fromVersion, toVersion } = this.getVersions(state, targetVersion);

    const earlyResult = this.checkForEarlyReturn(fromVersion, toVersion, verbose);
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
    const backupPath = createBackup
      ? await this.backupManager.createBackup(statePath as string, fromVersion as string)
      : undefined;

    const appliedMigrations = await this.executor.executeMigrations(
      migrationPath as { migrations: Migration[]; totalSteps: number },
      state as StateSchema,
      statePath as string,
      { createBackup, backupPath, verbose }
    );

    MigrationUtils.logSuccess(appliedMigrations.length, toVersion as string, verbose);

    return {
      success: true,
      fromVersion: fromVersion as string,
      toVersion: toVersion as string,
      appliedMigrations,
      backupPath,
    };
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
    const { migrationPath, fromVersion, toVersion, dryRun, verbose, state, statePath } = params;

    if (migrationPath.migrations.length === 0) {
      return {
        earlyReturn: MigrationUtils.noMigrationsResult(fromVersion, toVersion, verbose),
      };
    }

    MigrationUtils.logMigrationPlan(migrationPath, fromVersion, toVersion, verbose);

    if (dryRun) {
      return {
        earlyReturn: MigrationUtils.dryRunResult(migrationPath, fromVersion, toVersion),
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
        throw new Error(`State file not found: ${statePath}`);
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
}