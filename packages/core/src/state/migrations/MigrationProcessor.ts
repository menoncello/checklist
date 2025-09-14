import { EventEmitter } from 'events';
import type { Logger } from '../../utils/logger';
import type {
  Migration,
  MigrationOptions,
  MigrationProgress,
  StateSchema,
  MigrationRecord,
} from './types';

export class MigrationProcessor {
  constructor(
    private emitter: EventEmitter,
    private logger: Logger
  ) {}

  async processMigrations(
    migrations: Migration[],
    state: StateSchema,
    options: MigrationOptions
  ): Promise<{
    state: StateSchema;
    appliedMigrations: string[];
    migrationRecords: MigrationRecord[];
  }> {
    let migratedState = state;
    const appliedMigrations: string[] = [];
    const migrationRecords: MigrationRecord[] =
      (state.migrations as MigrationRecord[] | undefined) ?? [];

    for (let i = 0; i < migrations.length; i++) {
      const result = await this.processSingleMigration(
        migrations[i],
        migratedState,
        { index: i, totalMigrations: migrations.length, options }
      );

      migratedState = result.state;
      appliedMigrations.push(result.migrationKey);
      migrationRecords.push(result.record);
    }

    return { state: migratedState, appliedMigrations, migrationRecords };
  }

  private async processSingleMigration(
    migration: Migration,
    state: StateSchema,
    context: { index: number; totalMigrations: number; options: MigrationOptions }
  ): Promise<{
    state: StateSchema;
    migrationKey: string;
    record: MigrationRecord;
  }> {
    const migrationKey = `${migration.fromVersion}->${migration.toVersion}`;

    this.emitProgress(migration, context.index, context.totalMigrations);
    this.logMigrationStart(migration, context.options.verbose);

    const migratedState = await this.applyMigration(migration, state);
    await this.validateMigration(migration, migratedState);

    const record = this.createMigrationRecord(migration);

    this.logMigrationComplete(migration, context.options.verbose);

    return { state: migratedState, migrationKey, record };
  }

  private emitProgress(
    migration: Migration,
    index: number,
    totalMigrations: number
  ): void {
    const progress: MigrationProgress = {
      currentStep: index + 1,
      totalSteps: totalMigrations,
      currentMigration: `${migration.fromVersion}->${migration.toVersion}`,
      percentage: ((index + 1) / totalMigrations) * 100,
    };

    this.emitter.emit('migration:progress', progress);
  }

  private logMigrationStart(migration: Migration, verbose?: boolean): void {
    if (verbose === true) {
      this.logger.info({
        msg: 'Applying migration',
        toVersion: migration.toVersion,
      });
    }
  }

  private async applyMigration(
    migration: Migration,
    state: StateSchema
  ): Promise<StateSchema> {
    if (migration.script === undefined || migration.script === null) {
      throw new Error(`Migration script not found for ${migration.fromVersion}->${migration.toVersion}`);
    }

    const migratedState = await migration.script.up(state);
    return migratedState as StateSchema;
  }

  private async validateMigration(
    migration: Migration,
    state: StateSchema
  ): Promise<void> {
    if (migration.validate && !migration.validate(state)) {
      throw new Error(`Migration validation failed for ${migration.fromVersion}->${migration.toVersion}`);
    }
  }

  private createMigrationRecord(migration: Migration): MigrationRecord {
    return {
      fromVersion: migration.fromVersion,
      toVersion: migration.toVersion,
      appliedAt: new Date().toISOString(),
      checksum: migration.checksum,
    };
  }

  private logMigrationComplete(migration: Migration, verbose?: boolean): void {
    if (verbose === true) {
      this.logger.info({
        msg: 'Migration applied successfully',
        toVersion: migration.toVersion,
      });
    }
  }
}