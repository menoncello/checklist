import { createLogger } from '../../utils/logger';
import { MigrationRegistry } from './MigrationRegistry';
import { Migration, StateSchema, MigrationError } from './types';

const logger = createLogger('checklist:migration:validator');

export class MigrationValidator {
  private registry: MigrationRegistry;

  constructor(registry: MigrationRegistry) {
    this.registry = registry;
  }

  async validateMigrationPath(
    fromVersion: string,
    targetVersion: string
  ): Promise<{ migrations: Migration[]; totalSteps: number }> {
    try {
      const migrations = this.registry.getMigrationPath(fromVersion, targetVersion);
      if (migrations.length === 0) {
        return this.handleNoMigrations(fromVersion, targetVersion);
      }
      return await this.validateAndPrepareMigrations(migrations, fromVersion, targetVersion);
    } catch (error) {
      logger.error({ msg: 'Migration path validation failed', error, fromVersion, targetVersion });
      throw error;
    }
  }

  private handleNoMigrations(fromVersion: string, targetVersion: string): { migrations: Migration[]; totalSteps: number } {
    logger.info({ msg: 'No migrations needed', fromVersion, targetVersion });
    return { migrations: [], totalSteps: 0 };
  }

  private async validateAndPrepareMigrations(
    migrations: Migration[],
    fromVersion: string,
    targetVersion: string
  ): Promise<{ migrations: Migration[]; totalSteps: number }> {
    await this.validateMigrationChain(migrations);
    const totalSteps = this.calculateTotalSteps(migrations);
    logger.info({
      msg: 'Migration path validated',
      fromVersion,
      targetVersion,
      migrationsCount: migrations.length,
      totalSteps,
      migrationIds: migrations.map(m => `${m.fromVersion}->${m.toVersion}`),
    });
    return { migrations, totalSteps };
  }

  async validateMigration(migration: Migration, state: StateSchema): Promise<void> {
    try {
      this.checkIfAlreadyApplied(migration, state);
      this.checkVersionMatch(migration, state);
      await this.validatePrerequisites(migration, state);
      this.logMigrationValidationSuccess(migration);
    } catch (error) {
      logger.error({ msg: 'Migration validation failed', error, migrationId: migration.id });
      throw error;
    }
  }

  private checkIfAlreadyApplied(migration: Migration, state: StateSchema): void {
    const migrations = (state.migrations as Array<{id: string; fromVersion: string; toVersion: string}>) ?? [];
    const isApplied = migrations.some(m =>
      m.id === migration.id ||
      (m.fromVersion === migration.fromVersion && m.toVersion === migration.toVersion)
    );

    if (isApplied) {
      throw new MigrationError(
        `Migration ${migration.fromVersion}->${migration.toVersion} already applied`,
        'MIGRATION_ALREADY_APPLIED',
        migration.id
      );
    }
  }

  private checkVersionMatch(migration: Migration, state: StateSchema): void {
    const currentVersion = state.version || '0.0.0';
    if (currentVersion !== migration.fromVersion) {
      throw new MigrationError(
        `State version mismatch. Expected: ${migration.fromVersion}, Found: ${currentVersion}`,
        'VERSION_MISMATCH',
        migration.id
      );
    }
  }

  private logMigrationValidationSuccess(migration: Migration): void {
    logger.debug({
      msg: 'Migration validation passed',
      migrationId: migration.id,
      fromVersion: migration.fromVersion,
      toVersion: migration.toVersion,
    });
  }

  async validateStateIntegrity(state: StateSchema): Promise<void> {
    try {
      this.validateStateObject(state);
      this.validateStateVersion(state);
      this.validateStateMigrations(state);
      this.logValidationSuccess(state);
    } catch (error) {
      logger.error({ msg: 'State integrity validation failed', error });
      throw error;
    }
  }

  private validateStateObject(state: StateSchema): void {
    if (state === null || state === undefined || typeof state !== 'object') {
      throw new MigrationError('Invalid state: not an object', 'INVALID_STATE_FORMAT');
    }
  }

  private validateStateVersion(state: StateSchema): void {
    if (!this.isValidString(state.version) || typeof state.version !== 'string') {
      throw new MigrationError('Invalid state: missing or invalid version', 'INVALID_VERSION');
    }
  }

  private validateStateMigrations(state: StateSchema): void {
    if (state.migrations && !Array.isArray(state.migrations)) {
      throw new MigrationError('Invalid state: migrations must be an array', 'INVALID_MIGRATIONS_RECORD');
    }
  }

  private logValidationSuccess(state: StateSchema): void {
    logger.debug({
      msg: 'State integrity validation passed',
      version: state.version,
      migrationsCount: (state.migrations as Array<unknown>)?.length ?? 0,
    });
  }

  private async validateMigrationChain(migrations: Migration[]): Promise<void> {
    if (migrations.length === 0) return;

    // Check chain continuity
    for (let i = 0; i < migrations.length - 1; i++) {
      const current = migrations[i];
      const next = migrations[i + 1];

      if (current.toVersion !== next.fromVersion) {
        throw new MigrationError(
          `Migration chain broken between ${current.toVersion} and ${next.fromVersion}`,
          'BROKEN_MIGRATION_CHAIN'
        );
      }
    }

    // Validate each migration
    for (const migration of migrations) {
      await this.validateMigrationDefinition(migration);
    }
  }

  private async validateMigrationDefinition(migration: Migration): Promise<void> {
    this.validateMigrationId(migration);
    this.validateMigrationVersions(migration);
    this.validateMigrationFunctions(migration);
  }

  private validateMigrationId(migration: Migration): void {
    if (!this.isValidString(migration.id)) {
      throw new MigrationError(
        'Migration missing required id field',
        'INVALID_MIGRATION_DEFINITION'
      );
    }
  }

  private validateMigrationVersions(migration: Migration): void {
    if (!this.isValidString(migration.fromVersion) || !this.isValidString(migration.toVersion)) {
      throw new MigrationError(
        'Migration missing version information',
        'INVALID_MIGRATION_DEFINITION',
        migration.id
      );
    }
  }

  private validateMigrationFunctions(migration: Migration): void {
    if (!this.isValidFunction(migration.migrate)) {
      throw new MigrationError(
        'Migration missing migrate function',
        'INVALID_MIGRATION_DEFINITION',
        migration.id
      );
    }

    if (migration.validate && typeof migration.validate !== 'function') {
      throw new MigrationError(
        'Migration validate must be a function',
        'INVALID_MIGRATION_DEFINITION',
        migration.id
      );
    }
  }

  private isValidString(value: unknown): boolean {
    return value !== null && value !== undefined && value !== '';
  }

  private isValidFunction(value: unknown): boolean {
    return value !== null && value !== undefined && typeof value === 'function';
  }

  private async validatePrerequisites(migration: Migration, state: StateSchema): Promise<void> {
    if (migration.prerequisites === null || migration.prerequisites === undefined || migration.prerequisites.length === 0) {
      return;
    }

    const appliedMigrations = (state.migrations as Array<{id: string}>) ?? [];
    const appliedIds = new Set(appliedMigrations.map(m => m.id));

    for (const prerequisiteId of migration.prerequisites) {
      if (!appliedIds.has(prerequisiteId)) {
        throw new MigrationError(
          `Migration prerequisite not met: ${prerequisiteId}`,
          'PREREQUISITE_NOT_MET',
          migration.id
        );
      }
    }
  }

  private calculateTotalSteps(migrations: Migration[]): number {
    return migrations.reduce((total, migration) => {
      // Each migration has base steps: validate, apply, record
      let steps = 3;

      // Add custom steps if defined
      if (migration.estimatedSteps !== null && migration.estimatedSteps !== undefined && migration.estimatedSteps > 0) {
        steps += migration.estimatedSteps;
      }

      return total + steps;
    }, 0);
  }
}