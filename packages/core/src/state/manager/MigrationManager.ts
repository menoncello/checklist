import * as yaml from 'js-yaml';
import { createLogger } from '../../utils/logger';
import { BackupManager } from '../BackupManager';
import { DirectoryManager } from '../DirectoryManager';
import { SCHEMA_VERSION } from '../constants';
import { MigrationRunner } from '../migrations/MigrationRunner';
import { BackupInfo, StateSchema } from '../migrations/types';
import { detectVersion } from '../migrations/versionDetection';
import { ChecklistState } from '../types';

export class MigrationManager {
  private logger = createLogger('checklist:state:migration');

  constructor(
    private directoryManager: DirectoryManager,
    private migrationRunner: MigrationRunner,
    private backupManager: BackupManager
  ) {}

  async checkMigrationStatus(): Promise<{
    currentVersion: string;
    latestVersion: string;
    targetVersion: string;
    needsMigration: boolean;
    availableMigrations: string[];
    migrationPath: string[];
  }> {
    const statePath = this.directoryManager.getStatePath();

    if ((await this.directoryManager.fileExists(statePath)) !== true) {
      return this.createNewFileStatus();
    }

    const currentVersion = await this.getCurrentVersion(statePath);
    const availableMigrations = this.getAvailableMigrations(currentVersion);

    return {
      currentVersion,
      latestVersion: SCHEMA_VERSION,
      targetVersion: SCHEMA_VERSION,
      needsMigration: currentVersion !== SCHEMA_VERSION,
      availableMigrations,
      migrationPath: availableMigrations,
    };
  }

  private createNewFileStatus() {
    return {
      currentVersion: 'none',
      latestVersion: SCHEMA_VERSION,
      targetVersion: SCHEMA_VERSION,
      needsMigration: false,
      availableMigrations: [],
      migrationPath: [],
    };
  }

  private async getCurrentVersion(statePath: string): Promise<string> {
    try {
      const content = await this.directoryManager.readFile(statePath);
      const parsed = yaml.load(content) as unknown;
      return detectVersion(parsed);
    } catch (error) {
      this.logger.error({ msg: 'Failed to detect current version', error });
      return 'unknown';
    }
  }

  private getAvailableMigrations(fromVersion: string): string[] {
    // This would be implemented based on the migration registry
    // For now, return a placeholder
    const migrations: string[] = [];

    if (fromVersion === '1.0.0' && SCHEMA_VERSION !== '1.0.0') {
      migrations.push('1.0.0 -> 1.1.0');
    }

    return migrations;
  }

  async listBackups(): Promise<BackupInfo[]> {
    try {
      const manifests = await this.backupManager.listBackups();
      return manifests.map((manifest) => ({
        path: manifest.filename,
        version: manifest.schemaVersion,
        timestamp: manifest.createdAt,
        createdAt: manifest.createdAt,
        size: manifest.size,
      }));
    } catch (error) {
      this.logger.error({ msg: 'Failed to list backups', error });
      return [];
    }
  }

  async restoreFromBackup(backupPath: string): Promise<void> {
    this.logger.info({ msg: 'Starting backup restoration', backupPath });

    try {
      await this.validateBackupPath(backupPath);
      await this.performBackupRestore(backupPath);
      this.logger.info({ msg: 'Backup restoration completed successfully' });
    } catch (error) {
      this.logger.error({ msg: 'Backup restoration failed', error });
      throw error;
    }
  }

  private async validateBackupPath(backupPath: string): Promise<void> {
    if ((await this.directoryManager.fileExists(backupPath)) !== true) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }
  }

  private async performBackupRestore(backupPath: string): Promise<void> {
    const statePath = this.directoryManager.getStatePath();
    await this.backupCurrentState(statePath);
    await this.directoryManager.writeFile(
      statePath,
      await this.directoryManager.readFile(backupPath)
    );
    await this.migrateIfNeeded(statePath);
  }

  private async backupCurrentState(statePath: string): Promise<void> {
    if (await this.directoryManager.fileExists(statePath)) {
      const content = await this.directoryManager.readFile(statePath);
      await this.backupManager.createBackup(
        yaml.load(content) as ChecklistState
      );
    }
  }

  private async migrateIfNeeded(statePath: string): Promise<void> {
    const status = await this.checkMigrationStatus();
    if (!status.needsMigration) return;

    this.logger.info({ msg: 'Restored state requires migration' });
    const state = await this.loadAndPrepareState(
      statePath,
      status.currentVersion
    );
    const migrated = await this.migrationRunner.migrateState(
      state,
      status.currentVersion,
      status.targetVersion
    );
    await this.directoryManager.writeFile(statePath, yaml.dump(migrated));
  }

  private async loadAndPrepareState(
    statePath: string,
    currentVersion: string
  ): Promise<StateSchema> {
    const content = await this.directoryManager.readFile(statePath);
    const state = yaml.load(content) as ChecklistState;
    const now = new Date().toISOString();
    const { conflicts, recovery, activeInstance, ...rest } = state;
    return {
      ...rest,
      version: state.version ?? currentVersion,
      lastModified: state.metadata?.modified ?? now,
      metadata: {
        created: state.metadata?.created ?? now,
        modified: state.metadata?.modified ?? now,
      },
      activeInstance: activeInstance as unknown,
      recovery: recovery as unknown,
      conflicts: conflicts !== undefined ? [conflicts] : undefined,
    };
  }

  async runMigration(): Promise<void> {
    const statePath = this.directoryManager.getStatePath();
    if (!(await this.directoryManager.fileExists(statePath))) {
      throw new Error('No state file found to migrate');
    }

    const status = await this.checkMigrationStatus();
    if (!status.needsMigration) {
      this.logger.info({ msg: 'No migration needed' });
      return;
    }

    this.logger.info({
      msg: 'Running migration',
      from: status.currentVersion,
      to: status.latestVersion,
    });

    const state = await this.loadAndPrepareState(
      statePath,
      status.currentVersion
    );
    const migrated = await this.migrationRunner.migrateState(
      state,
      status.currentVersion,
      status.latestVersion ?? status.targetVersion
    );
    await this.directoryManager.writeFile(statePath, yaml.dump(migrated));
  }
}
