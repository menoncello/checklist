import { createLogger } from '../../utils/logger';
import { BackupManager } from '../BackupManager';
import { DirectoryManager } from '../DirectoryManager';
import { SCHEMA_VERSION } from '../constants';
import { MigrationRunner } from '../migrations/MigrationRunner';
import { BackupInfo } from '../migrations/types';
import { detectVersion } from '../migrations/versionDetection';

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
      return detectVersion(content);
    } catch (error) {
      this.logger.error('Failed to detect current version', { error });
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
      return await this.backupManager.listBackups();
    } catch (error) {
      this.logger.error('Failed to list backups', { error });
      return [];
    }
  }

  async restoreFromBackup(backupPath: string): Promise<void> {
    this.logger.info('Starting backup restoration', { backupPath });

    try {
      await this.validateBackupPath(backupPath);
      await this.performBackupRestore(backupPath);
      this.logger.info('Backup restoration completed successfully');
    } catch (error) {
      this.logger.error('Backup restoration failed', { error });
      throw error;
    }
  }

  private async validateBackupPath(backupPath: string): Promise<void> {
    if ((await this.directoryManager.fileExists(backupPath)) !== true) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }
  }

  private async performBackupRestore(backupPath: string): Promise<void> {
    // Create a backup of current state before restoring
    const statePath = this.directoryManager.getStatePath();
    if ((await this.directoryManager.fileExists(statePath)) === true) {
      await this.backupManager.createBackup(statePath, 'pre-restore');
    }

    // Copy backup content to current state file
    const backupContent = await this.directoryManager.readFile(backupPath);
    await this.directoryManager.writeFile(statePath, backupContent);

    // Check if the restored state needs migration
    const migrationStatus = await this.checkMigrationStatus();
    if (migrationStatus.needsMigration) {
      this.logger.info('Restored state requires migration');
      await this.migrationRunner.migrateState(statePath);
    }
  }

  async runMigration(): Promise<void> {
    const statePath = this.directoryManager.getStatePath();

    if ((await this.directoryManager.fileExists(statePath)) !== true) {
      throw new Error('No state file found to migrate');
    }

    const status = await this.checkMigrationStatus();
    if (!status.needsMigration) {
      this.logger.info('No migration needed');
      return;
    }

    this.logger.info('Running migration', {
      from: status.currentVersion,
      to: status.latestVersion,
    });

    await this.migrationRunner.migrateState(statePath);
  }
}