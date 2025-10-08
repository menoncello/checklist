import { createLogger } from '../../utils/logger';
import { Migration, MigrationResult } from './types';

const logger = createLogger('checklist:migration:utils');

export class MigrationUtils {
  static noMigrationsResult(
    fromVersion: string,
    toVersion: string,
    verbose: boolean
  ): MigrationResult {
    if (verbose) {
      logger.info({
        msg: 'State file is already at target version',
        fromVersion,
        toVersion,
      });
    }
    return {
      success: true,
      fromVersion,
      toVersion,
      appliedMigrations: [],
    };
  }

  static dryRunResult(
    migrationPath: { migrations: Migration[]; totalSteps: number },
    fromVersion: string,
    toVersion: string
  ): MigrationResult {
    const migrationsToApply = migrationPath.migrations.map(
      (m) => m.id ?? `${m.fromVersion}->${m.toVersion}`
    );

    logger.info({
      msg: 'Dry run completed - no changes made',
      fromVersion,
      toVersion,
      migrationsToApply,
    });

    return {
      success: true,
      fromVersion,
      toVersion,
      appliedMigrations: migrationsToApply,
    };
  }

  static logMigrationPlan(
    migrationPath: { migrations: Migration[]; totalSteps: number },
    fromVersion: string,
    toVersion: string,
    verbose: boolean
  ): void {
    if (verbose) {
      logger.info({
        msg: 'Starting migration',
        fromVersion,
        toVersion,
        migrationsCount: migrationPath.migrations.length,
        totalSteps: migrationPath.totalSteps,
      });

      migrationPath.migrations.forEach((migration, index) => {
        logger.info({
          msg: `Migration ${index + 1}/${migrationPath.migrations.length}`,
          id: migration.id ?? 'unknown',
          from: migration.fromVersion,
          to: migration.toVersion,
          description: migration.description,
        });
      });
    }
  }

  static logSuccess(
    appliedCount: number,
    toVersion: string,
    verbose: boolean
  ): void {
    if (verbose) {
      logger.info({
        msg: 'Migration completed successfully',
        appliedMigrations: appliedCount,
        finalVersion: toVersion,
      });
    }
  }

  static createSuccessResult(
    fromVersion: string,
    toVersion: string,
    appliedMigrations: string[],
    message?: string
  ): MigrationResult {
    if (message != null && message.length > 0) {
      logger.info({ msg: message, fromVersion, toVersion });
    }

    return {
      success: true,
      fromVersion,
      toVersion,
      appliedMigrations,
    };
  }

  static isVersionLess(fromVersion: string, toVersion: string): boolean {
    // Simple version comparison for semantic versions
    const fromParts = fromVersion.split('.').map(Number);
    const toParts = toVersion.split('.').map(Number);

    for (let i = 0; i < Math.max(fromParts.length, toParts.length); i++) {
      const fromPart = fromParts[i] || 0;
      const toPart = toParts[i] || 0;

      if (fromPart < toPart) return true;
      if (fromPart > toPart) return false;
    }

    return false;
  }

  static createErrorResult(
    error: unknown,
    targetVersion?: string
  ): MigrationResult {
    const errorMessage = (error as Error)?.message ?? 'Unknown migration error';

    logger.error({
      msg: 'Migration failed',
      error: errorMessage,
      targetVersion,
    });

    return {
      success: false,
      error: new Error(errorMessage),
      fromVersion: 'unknown',
      toVersion: targetVersion ?? 'unknown',
      appliedMigrations: [],
    };
  }
}
