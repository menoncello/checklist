import { createLogger } from '../../utils/logger';
import { Migration, MigrationError, StateSchema } from './types';

const logger = createLogger('checklist:migration:helpers');

export class MigrationHelpers {
  static logMigrationStart(migration: Migration): void {
    logger.debug({
      msg: 'Applying migration',
      migrationId: migration.id ?? 'unknown',
      fromVersion: migration?.fromVersion ?? 'unknown',
      toVersion: migration?.toVersion ?? 'unknown',
    });
  }

  static validateMigrationResult(result: unknown, migration: Migration): void {
    if (result === null || result === undefined || typeof result !== 'object') {
      throw new MigrationError(
        'Migration must return a valid state object',
        migration?.fromVersion ?? 'unknown',
        migration?.toVersion ?? 'unknown'
      );
    }
  }

  static createMigrationExecutionError(
    error: Error,
    migration: Migration
  ): MigrationError {
    return new MigrationError(
      `Migration execution failed: ${error.message}`,
      migration?.fromVersion ?? 'unknown',
      migration?.toVersion ?? 'unknown',
      error
    );
  }

  static reportProgress(
    migration: Migration,
    stepIndex: number,
    totalSteps: number,
    verbose: boolean
  ): void {
    if (verbose) {
      logger.info({
        msg: `Executing migration ${stepIndex + 1}/${totalSteps}`,
        migrationId: migration.id ?? 'unknown',
        fromVersion: migration?.fromVersion ?? 'unknown',
        toVersion: migration?.toVersion ?? 'unknown',
      });
    }
  }

  static recordMigrationId(
    migration: Migration,
    appliedMigrations: string[]
  ): void {
    appliedMigrations.push(
      migration.id ?? `${migration.fromVersion}->${migration.toVersion}`
    );
  }

  static async executeMigrationFunction(
    migration: Migration,
    state: StateSchema
  ): Promise<unknown> {
    if (migration?.migrate) {
      return await migration.migrate(state);
    }
    if (migration?.up !== undefined) {
      return migration.up(state);
    }
    throw new MigrationError(
      'No migration function found (migrate or up)',
      migration?.fromVersion ?? 'unknown',
      migration?.toVersion ?? 'unknown'
    );
  }

  static buildFinalState(result: unknown, migration: Migration): StateSchema {
    return {
      ...(result as object),
      version: migration.toVersion,
    } as StateSchema;
  }
}
