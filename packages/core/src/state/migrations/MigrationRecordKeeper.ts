import * as yaml from 'js-yaml';
import { createLogger } from '../../utils/logger';
import { Migration, StateSchema, MigrationRecord } from './types';

const logger = createLogger('checklist:migration:records');

export class MigrationRecordKeeper {
  async recordMigration(params: {
    migration: Migration;
    state: StateSchema;
    statePath: string;
    startTime: number;
    endTime: number;
    success: boolean;
    error?: Error;
  }): Promise<StateSchema> {
    const { migration, state, statePath, startTime, endTime, success, error } =
      params;

    try {
      const migrationRecord = await this.createMigrationRecord({
        migration,
        startTime,
        endTime,
        success,
        error,
      });
      const updatedState = this.addMigrationRecord(state, migrationRecord);
      await this.persistState(updatedState, statePath);

      const duration = endTime - startTime;
      this.logMigrationRecorded(migration, success, duration);
      return updatedState;
    } catch (recordError) {
      this.logRecordingFailure(recordError as Error, migration);
      throw new Error(
        `Failed to record migration: ${(recordError as Error).message}`
      );
    }
  }

  private async createMigrationRecord(params: {
    migration: Migration;
    startTime: number;
    endTime: number;
    success: boolean;
    error?: Error;
  }): Promise<MigrationRecord> {
    const {
      migration,
      startTime: _startTime,
      endTime: _endTime,
      success,
      error,
    } = params;

    const migrationRecord: MigrationRecord = {
      from: migration.fromVersion,
      to: migration.toVersion,
      applied: new Date().toISOString(),
      appliedAt: new Date().toISOString(),
      changes: success
        ? [`Applied migration ${migration.id ?? 'unknown'}`]
        : undefined,
    };

    // Store additional metadata in changes array if needed
    if (error !== undefined) {
      migrationRecord.changes = [
        ...(migrationRecord.changes ?? []),
        `Error: ${error.message}`,
      ];
    }

    return migrationRecord;
  }

  private logMigrationRecorded(
    migration: Migration,
    success: boolean,
    duration: number
  ): void {
    logger.info({
      msg: 'Migration record saved',
      migrationId: migration.id,
      success,
      duration,
    });
  }

  private logRecordingFailure(recordError: Error, migration: Migration): void {
    logger.error({
      msg: 'Failed to record migration',
      error: recordError,
      migrationId: migration.id,
    });
  }

  private addMigrationRecord(
    state: StateSchema,
    record: MigrationRecord
  ): StateSchema {
    const migrations = (state.migrations as MigrationRecord[]) ?? [];

    // Remove any existing record for this migration (for retries)
    const filteredMigrations = migrations.filter(
      (m) => !(m.from === record.from && m.to === record.to)
    );

    return {
      ...state,
      version: record.to,
      migrations: [...filteredMigrations, record],
    };
  }

  async getMigrationHistory(statePath: string): Promise<MigrationRecord[]> {
    try {
      const state = await this.loadState(statePath);
      return (state.migrations as MigrationRecord[]) ?? [];
    } catch (error) {
      logger.error({
        msg: 'Failed to load migration history',
        error,
        statePath,
      });
      return [];
    }
  }

  async isAlreadyApplied(
    statePath: string,
    migration: Migration
  ): Promise<boolean> {
    try {
      const history = await this.getMigrationHistory(statePath);
      return history.some(
        (record) =>
          record.from === migration.fromVersion &&
          record.to === migration.toVersion
      );
    } catch (error) {
      logger.warn({
        msg: 'Failed to check migration application status',
        error,
        migrationId: migration.id,
      });
      return false;
    }
  }

  async getLastSuccessfulMigration(
    statePath: string
  ): Promise<MigrationRecord | null> {
    try {
      const history = await this.getMigrationHistory(statePath);
      const successfulMigrations = history
        .filter(
          (record) =>
            record.changes !== null &&
            record.changes !== undefined &&
            !record.changes.some((c) => c.startsWith('Error:'))
        )
        .sort((a, b) => {
          const aTime = new Date(a.appliedAt ?? a.applied).getTime();
          const bTime = new Date(b.appliedAt ?? b.applied).getTime();
          return bTime - aTime;
        });

      return successfulMigrations[0] ?? null;
    } catch (error) {
      logger.error({
        msg: 'Failed to get last successful migration',
        error,
        statePath,
      });
      return null;
    }
  }

  async cleanupFailedMigrations(statePath: string): Promise<void> {
    try {
      const state = await this.loadState(statePath);
      const migrations = (state.migrations as MigrationRecord[]) ?? [];

      // Keep only successful migrations (those without error messages in changes)
      const successfulMigrations = migrations.filter((record) => {
        const hasErrorChanges = record.changes?.some((c) =>
          c.startsWith('Error:')
        );
        return hasErrorChanges !== true;
      });

      if (successfulMigrations.length !== migrations.length) {
        const cleanedState = {
          ...state,
          migrations: successfulMigrations,
        };

        await this.persistState(cleanedState, statePath);

        logger.info({
          msg: 'Cleaned up failed migrations',
          removed: migrations.length - successfulMigrations.length,
          remaining: successfulMigrations.length,
        });
      }
    } catch (error) {
      logger.error({
        msg: 'Failed to cleanup failed migrations',
        error,
        statePath,
      });
      throw error;
    }
  }

  private async calculateMigrationChecksum(
    migration: Migration
  ): Promise<string> {
    try {
      // Create a simple checksum based on migration properties
      const migrationString = JSON.stringify({
        id: migration.id,
        fromVersion: migration.fromVersion,
        toVersion: migration.toVersion,
        description: migration.description,
      });

      // Use Bun's built-in hashing (simple approach)
      const encoder = new TextEncoder();
      const data = encoder.encode(migrationString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      return hashHex.substring(0, 16); // Use first 16 characters
    } catch (error) {
      logger.warn({
        msg: 'Failed to calculate migration checksum',
        error,
        migrationId: migration.id,
      });
      return `fallback-${Date.now()}`;
    }
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

  private async persistState(
    state: StateSchema,
    statePath: string
  ): Promise<void> {
    try {
      const yamlContent = yaml.dump(state, {
        indent: 2,
        lineWidth: -1,
        sortKeys: true,
      });

      await Bun.write(statePath, yamlContent);

      logger.debug({
        msg: 'State persisted successfully',
        path: statePath,
        version: state.version,
      });
    } catch (error) {
      logger.error({
        msg: 'Failed to persist state',
        error,
        path: statePath,
      });
      throw error;
    }
  }
}
