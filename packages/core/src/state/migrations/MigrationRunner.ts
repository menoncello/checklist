import { EventEmitter } from 'events';
import * as yaml from 'js-yaml';
import { createLogger } from '../../utils/logger';
import { BackupManager } from './BackupManager';
import { MigrationExecutor } from './MigrationExecutor';
import { MigrationRecordKeeper } from './MigrationRecordKeeper';
import { MigrationRegistry } from './MigrationRegistry';
import { MigrationRunnerHelpers } from './MigrationRunnerHelpers';
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

    // Validate backup directory for path traversal
    if (backupDir.includes('..') || backupDir.includes('~')) {
      throw new Error('Invalid backup directory path');
    }

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

  async createBackup(statePath: string, version: string): Promise<string> { return this.backupManager.createBackup(statePath, version); }
  async listBackups(): Promise<BackupInfo[]> { return this.backupManager.listBackups(); }
  async rollback(statePath: string, backupPath: string): Promise<void> { this.emit('rollback:start'); await this.backupManager.rollback(statePath, backupPath); this.emit('rollback:complete'); }

  private async prepareMigrationContext(
    statePath: string,
    options: MigrationOptions,
    targetVersion?: string
  ): Promise<MigrationContext> {
    const { dryRun = false, verbose = false } = options;
    const state = await this.loadState(statePath);
    const { fromVersion, toVersion } = this.getVersions(state, targetVersion);
    const earlyResult = MigrationRunnerHelpers.checkForEarlyReturn(
      fromVersion,
      toVersion
    );
    if (earlyResult) return { earlyReturn: earlyResult };
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
    const { createBackup = true } = options;
    this.validateContext(context);
    const backupPath = await MigrationRunnerHelpers.createBackupIfNeeded(
      createBackup,
      context.statePath as string,
      context.fromVersion as string,
      this.backupManager
    );
    return await this.runMigrations(context, options, backupPath);
  }

  private async runMigrations(
    context: MigrationContext,
    options: MigrationOptions,
    backupPath?: string
  ): Promise<MigrationResult> {
    try {
      return await this.executeSuccess(context, options, backupPath);
    } catch (error) {
      return await this.executeFailure(context, error as Error, backupPath);
    }
  }

  private async executeSuccess(
    context: MigrationContext,
    options: MigrationOptions,
    backupPath?: string
  ): Promise<MigrationResult> {
    const migrations = await this.executeValidatedMigrations(
      context.migrationPath,
      context.state,
      context.statePath,
      {
        createBackup: options.createBackup ?? false,
        backupPath,
        verbose: options.verbose ?? false
      }
    );
    MigrationUtils.logSuccess(
      migrations.length,
      context.toVersion as string,
      options.verbose ?? false
    );
    return MigrationRunnerHelpers.buildSuccessResult(
      context.fromVersion,
      context.toVersion,
      migrations,
      backupPath
    );
  }

  private async executeFailure(
    context: MigrationContext,
    error: Error,
    backupPath?: string
  ): Promise<MigrationResult> {
    this.emit('migration:error', {
      error,
      fromVersion: context.fromVersion as string,
      toVersion: context.toVersion as string,
    });
    if (backupPath != null)
      await this.performRollback(context.statePath as string, backupPath);
    return MigrationRunnerHelpers.buildFailureResult(
      context.fromVersion,
      context.toVersion,
      error,
      backupPath
    );
  }

  private async performRollback(
    statePath: string,
    backupPath: string
  ): Promise<void> {
    try {
      this.emit('rollback:start');
      await this.backupManager.rollback(statePath, backupPath);
      this.emit('rollback:complete');
    } catch (rollbackError) {
      logger.error({
        msg: 'Rollback failed during migration failure',
        error: rollbackError,
      });
    }
  }
  private async executeValidatedMigrations(
    migrationPath: unknown,
    state: unknown,
    statePath: unknown,
    options: { createBackup: boolean; backupPath?: string; verbose: boolean }
  ): Promise<string[]> {
    return await this.executor.executeMigrations(
      migrationPath as { migrations: Migration[]; totalSteps: number },
      state as StateSchema,
      statePath as string,
      options
    );
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
    const noMigrationsResult = this.checkForNoMigrations(params);
    if (noMigrationsResult) return { earlyReturn: noMigrationsResult };

    MigrationUtils.logMigrationPlan(
      params.migrationPath,
      params.fromVersion,
      params.toVersion,
      params.verbose
    );

    const dryRunResult = this.checkForDryRun(params);
    if (dryRunResult) return { earlyReturn: dryRunResult };

    return this.buildExecutionContext(params);
  }

  private checkForNoMigrations(params: {
    migrationPath: { migrations: Migration[]; totalSteps: number };
    fromVersion: string;
    toVersion: string;
    verbose: boolean;
  }) {
    return params.migrationPath.migrations.length === 0
      ? MigrationUtils.noMigrationsResult(
          params.fromVersion,
          params.toVersion,
          params.verbose
        )
      : null;
  }
  private checkForDryRun(params: {
    migrationPath: { migrations: Migration[]; totalSteps: number };
    fromVersion: string;
    toVersion: string;
    dryRun: boolean;
  }) {
    return params.dryRun
      ? MigrationUtils.dryRunResult(
          params.migrationPath,
          params.fromVersion,
          params.toVersion
        )
      : null;
  }
  private buildExecutionContext(params: {
    state: StateSchema;
    fromVersion: string;
    toVersion: string;
    migrationPath: { migrations: Migration[]; totalSteps: number };
    statePath: string;
  }): MigrationContext {
    return {
      state: params.state,
      fromVersion: params.fromVersion,
      toVersion: params.toVersion,
      migrationPath: params.migrationPath,
      statePath: params.statePath,
    };
  }

  private validateContext(context: MigrationContext): void { const { state, fromVersion, toVersion, migrationPath, statePath } = context; if (state === undefined || fromVersion === undefined || toVersion === undefined || migrationPath === undefined || statePath === undefined) throw new Error('Invalid migration context'); }
  private getVersions(state: StateSchema, targetVersion?: string): { fromVersion: string; toVersion: string } { return { fromVersion: (state.version as string) ?? '0.0.0', toVersion: targetVersion ?? this.currentVersion }; }

  private async loadState(statePath: string): Promise<StateSchema> { try { const file = Bun.file(statePath); if (!(await file.exists())) { logger.info({ msg: 'State file not found, creating initial state', path: statePath }); return { version: '0.0.0', schemaVersion: '0.0.0', checklists: [], lastModified: new Date().toISOString() }; } const content = await file.text(); const state = yaml.load(content) as StateSchema; if (state == null || typeof state !== 'object') throw new Error('Invalid state file format'); return state; } catch (error) { logger.error({ msg: 'Failed to load state', error, path: statePath }); throw error; } }

  setMaxBackups(maxBackups: number): void { this.backupManager.setMaxBackups(maxBackups); }
  async restoreFromBackup(backupPath: string): Promise<StateSchema> { return await this.backupManager.restoreBackup(backupPath); }

  async migrateState(state: StateSchema, fromVersion: string, toVersion: string): Promise<StateSchema> { const path = this.registry.getMigrationPath(fromVersion, toVersion); if (path.migrations.length === 0) return state; let currentState = state; for (const m of path.migrations) { if (m.up == null) throw new Error(`Missing 'up' function: ${m.fromVersion} -> ${m.toVersion}`); currentState = m.up(currentState) as unknown as StateSchema; } return currentState; }
}
