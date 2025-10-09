import { createLogger } from '../../utils/logger';
import type { BackupManager } from './BackupManager';
import { MigrationUtils } from './MigrationUtils';
import {
  Migration,
  MigrationContext,
  MigrationResult,
  StateSchema,
} from './types';

const logger = createLogger('checklist:migration:helpers');

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

export class MigrationRunnerHelpers {
  /**
   * Create backup if needed
   */
  static async createBackupIfNeeded(
    createBackup: boolean,
    statePath: string,
    fromVersion: string,
    backupManager: BackupManager
  ): Promise<string | undefined> {
    if (!createBackup) return undefined;

    try {
      const backupPath = await backupManager.createBackup(
        statePath,
        fromVersion
      );
      logger.info({ msg: 'Backup created', backupPath });
      return backupPath;
    } catch (backupError) {
      logger.error({
        msg: 'Failed to create backup, proceeding without backup',
        error: backupError,
      });
      return undefined;
    }
  }

  /**
   * Build success result
   */
  static buildSuccessResult(
    fromVersion: unknown,
    toVersion: unknown,
    appliedMigrations: string[],
    backupPath?: string
  ): MigrationResult {
    return {
      success: true,
      fromVersion: fromVersion as string,
      toVersion: toVersion as string,
      appliedMigrations,
      backupPath,
    };
  }

  /**
   * Build failure result
   */
  static buildFailureResult(
    fromVersion: unknown,
    toVersion: unknown,
    error: Error,
    backupPath?: string
  ): MigrationResult {
    return {
      success: false,
      fromVersion: fromVersion as string,
      toVersion: toVersion as string,
      appliedMigrations: [],
      error,
      backupPath,
    };
  }

  /**
   * Check for early return conditions
   */
  static checkForEarlyReturn(
    fromVersion: string,
    toVersion: string
  ): MigrationResult | null {
    if (fromVersion === toVersion) {
      return MigrationUtils.createSuccessResult(
        fromVersion,
        toVersion,
        [],
        'No migration needed - versions are identical'
      );
    }

    if (MigrationUtils.isVersionLess(toVersion, fromVersion) === true) {
      return MigrationUtils.createErrorResult(
        new Error(`Cannot downgrade from ${fromVersion} to ${toVersion}`),
        toVersion
      );
    }

    return null;
  }

  /**
   * Load state from file
   */
  static async loadState(statePath: string): Promise<StateSchema> {
    try {
      const file = Bun.file(statePath);
      if (!(await file.exists())) {
        logger.info({
          msg: 'State file not found, creating initial state',
          path: statePath,
        });
        return {
          version: '0.0.0',
          schemaVersion: '0.0.0',
          checklists: [],
          lastModified: new Date().toISOString(),
        };
      }
      const content = await file.text();
      const state = (await import('js-yaml')).load(content) as StateSchema;
      if (state == null || typeof state !== 'object')
        throw new Error('Invalid state file format');
      return state;
    } catch (error) {
      logger.error({ msg: 'Failed to load state', error, path: statePath });
      throw error;
    }
  }

  /**
   * Get versions from state
   */
  static getVersions(
    state: StateSchema,
    currentVersion: string,
    targetVersion?: string
  ): { fromVersion: string; toVersion: string } {
    return {
      fromVersion: (state.version as string) ?? '0.0.0',
      toVersion: targetVersion ?? currentVersion,
    };
  }

  /**
   * Validate migration context
   */
  static validateContext(context: unknown): void {
    if (isEarlyReturn(context)) return;

    if (
      context === null ||
      context === undefined ||
      typeof context !== 'object'
    ) {
      throw new Error('Invalid migration context');
    }

    const { state, fromVersion, toVersion, migrationPath, statePath } =
      context as MigrationContext;
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

  /**
   * Build final migration context
   */
  static buildFinalContext(params: {
    migrationPath: { migrations: Migration[]; totalSteps: number };
    fromVersion: string;
    toVersion: string;
    dryRun: boolean;
    verbose: boolean;
    state: StateSchema;
    statePath: string;
  }): { earlyReturn?: MigrationResult } | MigrationContext {
    const noMigrationsResult = this.checkForNoMigrations(params);
    if (noMigrationsResult) return noMigrationsResult;

    MigrationUtils.logMigrationPlan(
      params.migrationPath,
      params.fromVersion,
      params.toVersion,
      params.verbose
    );

    const dryRunResult = this.checkForDryRun(params);
    if (dryRunResult) return dryRunResult;

    return this.buildExecutionContext(params);
  }

  /**
   * Check for no migrations
   */
  private static checkForNoMigrations(params: {
    migrationPath: { migrations: Migration[]; totalSteps: number };
    fromVersion: string;
    toVersion: string;
    verbose: boolean;
  }): { earlyReturn: MigrationResult } | null {
    return params.migrationPath.migrations.length === 0
      ? {
          earlyReturn: MigrationUtils.noMigrationsResult(
            params.fromVersion,
            params.toVersion,
            params.verbose
          ),
        }
      : null;
  }

  /**
   * Check for dry run
   */
  private static checkForDryRun(params: {
    migrationPath: { migrations: Migration[]; totalSteps: number };
    fromVersion: string;
    toVersion: string;
    dryRun: boolean;
  }): { earlyReturn: MigrationResult } | null {
    return params.dryRun
      ? {
          earlyReturn: MigrationUtils.dryRunResult(
            params.migrationPath,
            params.fromVersion,
            params.toVersion
          ),
        }
      : null;
  }

  /**
   * Build execution context
   */
  private static buildExecutionContext(params: {
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

  /**
   * Perform rollback with error handling
   */
  static async performRollback(
    statePath: string,
    backupPath: string,
    backupManager: BackupManager
  ): Promise<void> {
    try {
      await backupManager.rollback(statePath, backupPath);
    } catch (rollbackError) {
      logger.error({
        msg: 'Rollback failed during migration failure',
        error: rollbackError,
      });
      throw rollbackError;
    }
  }

  /**
   * Execute migrations with validation
   */
  static async executeValidatedMigrations(
    migrationConfig: MigrationExecutionConfig,
    executor: {
      executeMigrations: (
        migrationPath: { migrations: Migration[]; totalSteps: number },
        state: StateSchema,
        statePath: string,
        options: {
          createBackup: boolean;
          backupPath?: string;
          verbose: boolean;
        }
      ) => Promise<string[]>;
    }
  ): Promise<string[]> {
    const executorConfig = new ExecutorConfig(migrationConfig.options);
    return await executor.executeMigrations(
      migrationConfig.migrationPath,
      migrationConfig.state,
      migrationConfig.statePath,
      executorConfig.toOptions()
    );
  }
}

/**
 * Configuration for migration execution
 */
export class MigrationExecutionConfig {
  migrationPath: { migrations: Migration[]; totalSteps: number };
  state: StateSchema;
  statePath: string;
  options: { createBackup: boolean; backupPath?: string; verbose: boolean };

  constructor(
    migrationPath: { migrations: Migration[]; totalSteps: number },
    state: StateSchema,
    statePath: string,
    options: { createBackup: boolean; backupPath?: string; verbose: boolean }
  ) {
    this.migrationPath = migrationPath;
    this.state = state;
    this.statePath = statePath;
    this.options = options;
  }
}

/**
 * Configuration for migration executor
 */
class ExecutorConfig {
  private createBackup: boolean;
  private backupPath?: string;
  private verbose: boolean;

  constructor(options: {
    createBackup: boolean;
    backupPath?: string;
    verbose: boolean;
  }) {
    this.createBackup = options.createBackup;
    this.backupPath = options.backupPath;
    this.verbose = options.verbose;
  }

  toOptions() {
    return {
      createBackup: this.createBackup,
      backupPath: this.backupPath,
      verbose: this.verbose,
    };
  }
}
