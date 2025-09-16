import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger';
import { BackupManager } from './BackupManager';
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
    const {
      migration,
      migratedState,
      appliedMigrations,
      statePath,
      stepIndex,
      totalSteps,
      options,
    } = params;
    this.reportProgress(migration, stepIndex, totalSteps, options.verbose);

    try {
      const result = await this.executeAndRecordMigration(
        migration,
        migratedState,
        statePath,
        options.verbose
      );
      appliedMigrations.push(
        migration.id ?? `${migration.fromVersion}->${migration.toVersion}`
      );
      return result;
    } catch (error) {
      await this.handleMigrationError({
        error: error as Error,
        migration,
        state: migratedState,
        statePath,
        startTime: Date.now(),
        endTime: Date.now(),
      });
      throw error;
    }
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
        migrationId: migration.id,
        fromVersion: migration.fromVersion,
        toVersion: migration.toVersion,
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
      currentMigration: `${migration.fromVersion}->${migration.toVersion}`,
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

      if (migration.validate) {
        const isValid = await migration.validate(migratedState);
        if (!isValid) {
          throw new MigrationError(
            `Migration validation failed for ${migration.id}`,
            migration.fromVersion,
            migration.toVersion
          );
        }
      }

      await this.validator.validateStateIntegrity(migratedState);
      return migratedState;
    } catch (error) {
      logger.error({
        msg: 'Migration application failed',
        error,
        migrationId: migration.id,
        fromVersion: migration.fromVersion,
        toVersion: migration.toVersion,
      });
      throw error;
    }
  }

  private async handleMigrationError(params: {
    error: Error;
    migration: Migration;
    state: StateSchema;
    statePath: string;
    startTime: number;
    endTime: number;
  }): Promise<void> {
    const { error, migration, state, statePath, startTime, endTime } = params;

    try {
      await this.recordMigrationFailure({
        migration,
        state,
        statePath,
        startTime,
        endTime,
        error,
      });
      this.logMigrationError(error, migration);
      this.emitErrorEvent(migration, error);
    } catch (recordError) {
      this.logRecordingError(error, recordError as Error, migration);
    }
  }

  private async recordMigrationFailure(params: {
    migration: Migration;
    state: StateSchema;
    statePath: string;
    startTime: number;
    endTime: number;
    error: Error;
  }): Promise<void> {
    const { migration, state, statePath, startTime, endTime, error } = params;
    await this.recordKeeper.recordMigration({
      migration,
      state,
      statePath,
      startTime,
      endTime,
      success: false,
      error,
    });
  }

  private logMigrationError(error: Error, migration: Migration): void {
    logger.error({
      msg: 'Migration failed and recorded',
      migrationId: migration.id,
      error: error.message,
      fromVersion: migration.fromVersion,
      toVersion: migration.toVersion,
    });
  }

  private emitErrorEvent(migration: Migration, error: Error): void {
    this.emit('error', {
      migration,
      error,
      phase: 'execution',
    });
  }

  private logRecordingError(
    originalError: Error,
    recordError: Error,
    migration: Migration
  ): void {
    logger.error({
      msg: 'Failed to record migration error',
      originalError: originalError.message,
      recordError: recordError.message,
      migrationId: migration.id,
    });
  }

  private async applyMigration(
    migration: Migration,
    state: StateSchema
  ): Promise<StateSchema> {
    try {
      this.logMigrationStart(migration);

      let result: unknown;
      if (migration.migrate) {
        result = await migration.migrate(state);
      } else if (migration.up !== undefined) {
        result = migration.up(state);
      } else {
        throw new MigrationError(
          'No migration function found (migrate or up)',
          migration.fromVersion,
          migration.toVersion
        );
      }

      this.validateMigrationResult(result, migration);
      const finalState = {
        ...(result as object),
        version: migration.toVersion,
      } as StateSchema;

      return finalState;
    } catch (error) {
      if (error instanceof MigrationError) throw error;
      throw new MigrationError(
        `Migration execution failed: ${(error as Error).message}`,
        migration.fromVersion,
        migration.toVersion,
        error as Error
      );
    }
  }

  private logMigrationStart(migration: Migration): void {
    logger.debug({
      msg: 'Applying migration',
      migrationId: migration.id,
      fromVersion: migration.fromVersion,
      toVersion: migration.toVersion,
    });
  }

  private validateMigrationResult(result: unknown, migration: Migration): void {
    if (result === null || result === undefined || typeof result !== 'object') {
      throw new MigrationError(
        'Migration must return a valid state object',
        migration.fromVersion,
        migration.toVersion
      );
    }
  }
}
