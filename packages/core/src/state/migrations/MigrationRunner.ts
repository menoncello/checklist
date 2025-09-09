import { EventEmitter } from 'events';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { createLogger } from '../../utils/logger';
import { MigrationRegistry } from './MigrationRegistry';

const logger = createLogger('checklist:migration');
import {
  Migration,
  MigrationOptions,
  MigrationResult,
  MigrationProgress,
  BackupInfo,
  StateSchema,
  MigrationRecord,
  MigrationError,
} from './types';

export class MigrationRunner extends EventEmitter {
  private registry: MigrationRegistry;
  private backupDir: string;
  private maxBackups: number = 10;
  private currentVersion: string;

  constructor(
    registry: MigrationRegistry,
    backupDir: string = '.checklist/.backup',
    currentVersion: string = '1.0.0'
  ) {
    super();
    this.registry = registry;
    this.backupDir = backupDir;
    this.currentVersion = currentVersion;
  }

  async migrate(
    statePath: string,
    targetVersion?: string,
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    const { dryRun = false, createBackup = true, verbose = false } = options;

    try {
      const state = await this.loadState(statePath);
      const fromVersion =
        (state.version as string | undefined) ??
        (state.schemaVersion as string | undefined) ??
        '0.0.0';
      const toVersion = targetVersion ?? this.currentVersion;

      if (fromVersion === toVersion) {
        if (verbose) {
          logger.info({ msg: 'State file is already at target version' });
        }
        return {
          success: true,
          fromVersion,
          toVersion,
          appliedMigrations: [],
        };
      }

      const migrationPath = this.registry.findPath(fromVersion, toVersion);

      if (migrationPath.migrations.length === 0) {
        if (verbose) {
          logger.info({ msg: 'No migrations needed' });
        }
        return {
          success: true,
          fromVersion,
          toVersion,
          appliedMigrations: [],
        };
      }

      if (verbose) {
        logger.info({ msg: 'Starting migration', fromVersion, toVersion });
        logger.info({
          msg: 'Migrations to apply',
          count: migrationPath.migrations.length,
        });
        migrationPath.migrations.forEach((m) => {
          logger.info({
            msg: 'Migration step',
            from: m.fromVersion,
            to: m.toVersion,
            description: m.description,
          });
        });
      }

      if (dryRun) {
        logger.info({ msg: 'Dry run mode - no changes will be made' });
        return {
          success: true,
          fromVersion,
          toVersion,
          appliedMigrations: migrationPath.migrations.map(
            (m) => `${m.fromVersion}->${m.toVersion}`
          ),
        };
      }

      let backupPath: string | undefined;
      if (createBackup) {
        backupPath = await this.createBackup(statePath, fromVersion);
        if (verbose) {
          logger.info({ msg: 'Backup created', backupPath });
        }
      }

      let migratedState = state as StateSchema;
      const appliedMigrations: string[] = [];
      const migrationRecords: MigrationRecord[] =
        (state.migrations as MigrationRecord[] | undefined) ?? [];

      for (let i = 0; i < migrationPath.migrations.length; i++) {
        // Check if migration should be aborted
        // Note: AbortSignal.aborted is not available in all environments

        const migration = migrationPath.migrations[i];
        const progress: MigrationProgress = {
          currentStep: i + 1,
          totalSteps: migrationPath.totalSteps,
          currentMigration: `${migration.fromVersion}->${migration.toVersion}`,
          percentage: ((i + 1) / migrationPath.totalSteps) * 100,
        };

        this.emit('migration:progress', progress);

        if (verbose) {
          logger.info({
            msg: 'Applying migration',
            toVersion: migration.toVersion,
          });
        }

        try {
          migratedState = (await this.applyMigration(
            migration,
            migratedState
          )) as StateSchema;

          if (migration.validate && !migration.validate(migratedState)) {
            throw new Error('Migration validation failed');
          }

          migrationRecords.push({
            from: migration.fromVersion,
            to: migration.toVersion,
            applied: new Date().toISOString(),
            changes: [migration.description],
          });

          appliedMigrations.push(
            `${migration.fromVersion}->${migration.toVersion}`
          );

          await this.saveState(statePath, {
            ...migratedState,
            migrations: migrationRecords,
            schemaVersion: migration.toVersion,
            version: migration.toVersion,
            lastModified: new Date().toISOString(),
          });

          if (verbose) {
            logger.info({
              msg: 'Migration completed',
              toVersion: migration.toVersion,
            });
          }
        } catch (error) {
          const migrationError = new MigrationError(
            `Migration failed: ${error instanceof Error ? error.message : String(error)}`,
            migration.fromVersion,
            migration.toVersion,
            error instanceof Error ? error : undefined
          );

          this.emit('migration:error', migrationError);

          if (createBackup && backupPath !== undefined) {
            if (verbose) {
              logger.error({ msg: 'Migration failed, rolling back' });
            }
            await this.rollback(statePath, backupPath);
          }

          throw migrationError;
        }
      }

      if (verbose) {
        logger.info({ msg: 'Successfully migrated', toVersion });
      }

      this.emit('migration:complete', {
        fromVersion,
        toVersion,
        appliedMigrations,
      });

      return {
        success: true,
        fromVersion,
        toVersion,
        backupPath,
        appliedMigrations,
      };
    } catch (error) {
      return {
        success: false,
        fromVersion: '',
        toVersion: targetVersion ?? this.currentVersion,
        error: error instanceof Error ? error : new Error(String(error)),
        appliedMigrations: [],
      };
    }
  }

  private async applyMigration(
    migration: Migration,
    state: unknown
  ): Promise<unknown> {
    try {
      return migration.up(state);
    } catch (error) {
      throw new MigrationError(
        `Failed to apply migration: ${error instanceof Error ? error.message : String(error)}`,
        migration.fromVersion,
        migration.toVersion,
        error instanceof Error ? error : undefined
      );
    }
  }

  async createBackup(statePath: string, version: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `state-v${version}-${timestamp}.yaml`;

    // Sanitize backup directory path to prevent directory traversal
    const resolvedBackupDir = path.resolve(this.backupDir);
    // Check if the path tries to escape using ..
    const normalizedPath = path.normalize(this.backupDir);
    if (normalizedPath.startsWith('..') || normalizedPath.includes('../')) {
      throw new Error('Invalid backup directory path');
    }

    const backupPath = path.join(resolvedBackupDir, backupName);

    // Ensure backup path is within the backup directory
    const resolvedBackupPath = path.resolve(backupPath);
    if (!resolvedBackupPath.startsWith(resolvedBackupDir)) {
      throw new Error('Invalid backup file path');
    }

    const backupDirFile = Bun.file(resolvedBackupDir);
    const backupDirExists = await backupDirFile.exists();

    if (!backupDirExists) {
      await Bun.write(path.join(resolvedBackupDir, '.gitkeep'), '');
    }

    const sourceFile = Bun.file(statePath);
    const content = await sourceFile.text();
    await Bun.write(resolvedBackupPath, content);

    await this.rotateBackups();

    this.emit('backup:created', {
      path: resolvedBackupPath,
      version,
      timestamp,
    });

    return resolvedBackupPath;
  }

  private async rotateBackups(): Promise<void> {
    try {
      const backupFiles = await this.listBackups();

      if (backupFiles.length > this.maxBackups) {
        const filesToDelete = backupFiles
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
          .slice(0, backupFiles.length - this.maxBackups);

        for (const file of filesToDelete) {
          const filePath = Bun.file(file.path);
          if (await filePath.exists()) {
            await Bun.write(file.path, '');
            const { unlink } = await import('fs/promises');
            await unlink(file.path);
          }
        }
      }
    } catch (error) {
      logger.warn({ msg: 'Failed to rotate backups', error });
    }
  }

  async listBackups(): Promise<BackupInfo[]> {
    try {
      // Sanitize backup directory path
      const resolvedBackupDir = path.resolve(this.backupDir);
      const normalizedPath = path.normalize(this.backupDir);
      if (normalizedPath.startsWith('..') || normalizedPath.includes('../')) {
        throw new Error('Invalid backup directory path');
      }

      const { readdir, stat } = await import('fs/promises');
      const files = await readdir(resolvedBackupDir);

      const backupFiles: BackupInfo[] = [];

      for (const file of files) {
        if (file.startsWith('state-v') && file.endsWith('.yaml')) {
          const filePath = path.join(resolvedBackupDir, file);
          const stats = await stat(filePath);

          const match = file.match(/state-v(.+?)-(.+?)\.yaml/);
          if (match) {
            backupFiles.push({
              path: filePath,
              version: match[1],
              timestamp: match[2].replace(/-/g, ':'),
              size: stats.size,
            });
          }
        }
      }

      return backupFiles.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } catch {
      return [];
    }
  }

  async rollback(statePath: string, backupPath: string): Promise<void> {
    try {
      this.emit('rollback:start', { statePath, backupPath });

      const backupFile = Bun.file(backupPath);
      const content = await backupFile.text();
      await Bun.write(statePath, content);

      this.emit('rollback:complete', { statePath, backupPath });
    } catch (error) {
      throw new Error(
        `Rollback failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async restoreFromBackup(
    statePath: string,
    backupInfo: BackupInfo
  ): Promise<void> {
    await this.rollback(statePath, backupInfo.path);
  }

  private async loadState(statePath: string): Promise<StateSchema> {
    try {
      const file = Bun.file(statePath);
      const exists = await file.exists();

      if (!exists) {
        // Create an initial empty state that will be migrated
        const initialState = {
          schemaVersion: '0.0.0',
          version: '0.0.0',
          lastModified: new Date().toISOString(),
          checklists: [],
        };

        // Ensure directory exists
        const dir = path.dirname(statePath);
        const dirFile = Bun.file(dir);
        if (!(await dirFile.exists())) {
          await Bun.write(path.join(dir, '.gitkeep'), '');
        }

        // Save initial state
        await Bun.write(statePath, yaml.dump(initialState));

        return initialState;
      }

      const content = await file.text();
      const state = yaml.load(content) as StateSchema;

      return state;
    } catch (error) {
      throw new Error(
        `Failed to load state: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async saveState(
    statePath: string,
    state: StateSchema
  ): Promise<void> {
    try {
      const content = yaml.dump(state, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
      });

      const tempPath = `${statePath}.tmp`;
      await Bun.write(tempPath, content);

      const { rename } = await import('fs/promises');
      await rename(tempPath, statePath);
    } catch (error) {
      throw new Error(
        `Failed to save state: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  setMaxBackups(max: number): void {
    this.maxBackups = max;
  }

  getRegistry(): MigrationRegistry {
    return this.registry;
  }
}
