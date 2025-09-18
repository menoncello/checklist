import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger';
import { BackupManager } from './BackupManager';
import { MigrationHelpers } from './MigrationHelpers';
import { MigrationRecordKeeper } from './MigrationRecordKeeper';
import { MigrationValidator } from './MigrationValidator';
import {
  Migration,
  StateSchema,
  MigrationProgress,
  MigrationError,
} from './types';

const logger = createLogger('checklist:migration:executor');

export class MigrationExecutor extends EventEmitter {
  private validator: MigrationValidator;
  private recordKeeper: MigrationRecordKeeper;
  private backupManager: BackupManager;

  constructor(
    validator: MigrationValidator,
    recordKeeper: MigrationRecordKeeper,
    backupManager: BackupManager
  ) {
    super();
    this.validator = validator;
    this.recordKeeper = recordKeeper;
    this.backupManager = backupManager;
  }

  async executeMigrations(
    migrationPath: { migrations: Migration[]; totalSteps: number },
    state: StateSchema,
    statePath: string,
    options: {
      createBackup: boolean;
      backupPath?: string;
      verbose: boolean;
    }
  ): Promise<string[]> {
    let migratedState = state;
    const appliedMigrations: string[] = [];

    for (let i = 0; i < migrationPath.migrations.length; i++) {
      const migration = migrationPath.migrations[i];
      const result = await this.executeSingleMigration({
        migration,
        migratedState,
        appliedMigrations,
        statePath,
        stepIndex: i,
        totalSteps: migrationPath.totalSteps,
        options,
      });
      migratedState = result;
    }

    return appliedMigrations;
  }

  private async executeSingleMigration(params: {
    migration: Migration;
    migratedState: StateSchema;
    appliedMigrations: string[];
    statePath: string;
    stepIndex: number;
    totalSteps: number;
    options: { createBackup: boolean; backupPath?: string; verbose: boolean };
  }): Promise<StateSchema> {
    this.reportProgress(
      params.migration,
      params.stepIndex,
      params.totalSteps,
      params.options.verbose
    );

    try {
      return await this.runMigration(params);
    } catch (error) {
      await this.handleMigrationError(error as Error, params);
      throw error;
    }
  }

  private async runMigration(params: {
    migration: Migration;
    migratedState: StateSchema;
    appliedMigrations: string[];
    statePath: string;
    options: { verbose: boolean };
  }): Promise<StateSchema> {
    const result = await this.executeAndRecordMigration(
      params.migration,
      params.migratedState,
      params.statePath,
      params.options.verbose
    );
    MigrationHelpers.recordMigrationId(
      params.migration,
      params.appliedMigrations
    );
    return result;
  }

  private async handleMigrationError(
    error: Error,
    params: {
      migration: Migration;
      migratedState: StateSchema;
      statePath: string;
    }
  ): Promise<void> {
    await this.handleMigrationFailure({
      error,
      migration: params.migration,
      state: params.migratedState,
      statePath: params.statePath,
      startTime: Date.now(),
      endTime: Date.now(),
    });
  }

  private async executeAndRecordMigration(
    migration: Migration,
    migratedState: StateSchema,
    statePath: string,
    verbose: boolean
  ): Promise<StateSchema> {
    const startTime = Date.now();
    await this.validator.validateMigration(migration, migratedState);
    const newState = await this.applyAndValidateMigration(
      migration,
      migratedState
    );
    const endTime = Date.now();

    const recordedState = await this.recordKeeper.recordMigration({
      migration,
      state: newState,
      statePath,
      startTime,
      endTime,
      success: true,
    });

    this.logMigrationSuccess(migration, endTime - startTime, verbose);
    return recordedState;
  }

  private logMigrationSuccess(
    migration: Migration,
    duration: number,
    verbose: boolean
  ): void {
    if (verbose) {
      logger.info({
        msg: 'Migration applied successfully',
        migrationId: migration?.id ?? 'unknown',
        fromVersion: migration?.fromVersion ?? 'unknown',
        toVersion: migration?.toVersion ?? 'unknown',
        duration,
      });
    }
  }

  private reportProgress(
    migration: Migration,
    stepIndex: number,
    totalSteps: number,
    verbose: boolean
  ): void {
    const progress: MigrationProgress = {
      currentStep: stepIndex + 1,
      totalSteps,
      currentMigration: `${migration?.fromVersion || 'unknown'}->${migration?.toVersion || 'unknown'}`,
      percentage: Math.round(((stepIndex + 1) / totalSteps) * 100),
    };

    this.emit('progress', progress);

    if (verbose) {
      logger.info({
        msg: 'Migration progress',
        migrationId: migration.id ?? 'unknown',
        currentStep: progress.currentStep,
        totalSteps: progress.totalSteps,
        percentage: progress.percentage,
      });
    }
  }

  private async applyAndValidateMigration(
    migration: Migration,
    state: StateSchema
  ): Promise<StateSchema> {
    try {
      const migratedState = await this.applyMigration(migration, state);
      await this.validateMigrationResult(migration, migratedState);
      await this.validator.validateStateIntegrity(migratedState);
      return migratedState;
    } catch (error) {
      this.logMigrationApplicationError(migration, error as Error);
      throw error;
    }
  }

  private async validateMigrationResult(
    migration: Migration,
    migratedState: StateSchema
  ): Promise<void> {
    if (
      migration?.validate != null &&
      !(await migration.validate(migratedState))
    ) {
      throw new MigrationError(
        `Migration validation failed for ${migration.id ?? 'unknown'}`,
        migration?.fromVersion ?? 'unknown',
        migration?.toVersion ?? 'unknown'
      );
    }
  }

  private logMigrationApplicationError(
    migration: Migration,
    error: Error
  ): void {
    logger.error({
      msg: 'Migration application failed',
      error,
      migrationId: migration?.id ?? 'unknown',
      fromVersion: migration?.fromVersion ?? 'unknown',
      toVersion: migration?.toVersion ?? 'unknown',
    });
  }

  private async handleMigrationFailure(params: {
    error: Error;
    migration: Migration;
    state: StateSchema;
    statePath: string;
    startTime: number;
    endTime: number;
  }): Promise<void> {
    try {
      await this.recordFailure(params);
      this.logFailure(params.error, params.migration);
      this.emit('error', {
        migration: params.migration,
        error: params.error,
        phase: 'execution',
      });
    } catch (recordError) {
      this.logRecordError(params.error, recordError as Error, params.migration);
    }
  }

  private async recordFailure(params: {
    error: Error;
    migration: Migration;
    state: StateSchema;
    statePath: string;
    startTime: number;
    endTime: number;
  }): Promise<void> {
    await this.recordKeeper.recordMigration({
      migration: params.migration,
      state: params.state,
      statePath: params.statePath,
      startTime: params.startTime,
      endTime: params.endTime,
      success: false,
      error: params.error,
    });
  }

  private logFailure(error: Error, migration: Migration): void {
    logger.error({
      msg: 'Migration failed and recorded',
      migrationId: migration?.id ?? 'unknown',
      error: error.message,
      fromVersion: migration?.fromVersion ?? 'unknown',
      toVersion: migration?.toVersion ?? 'unknown',
    });
  }

  private logRecordError(
    originalError: Error,
    recordError: Error,
    migration: Migration
  ): void {
    logger.error({
      msg: 'Failed to record migration error',
      originalError: originalError?.message ?? 'Unknown error',
      recordError: recordError?.message ?? 'Unknown error',
      migrationId: migration?.id ?? 'unknown',
    });
  }

  private async applyMigration(
    migration: Migration,
    state: StateSchema
  ): Promise<StateSchema> {
    try {
      MigrationHelpers.logMigrationStart(migration);
      const result = await MigrationHelpers.executeMigrationFunction(
        migration,
        state
      );
      MigrationHelpers.validateMigrationResult(result, migration);
      return MigrationHelpers.buildFinalState(result, migration);
    } catch (error) {
      if (error instanceof MigrationError) throw error;
      throw MigrationHelpers.createMigrationExecutionError(
        error as Error,
        migration
      );
    }
  }
}
