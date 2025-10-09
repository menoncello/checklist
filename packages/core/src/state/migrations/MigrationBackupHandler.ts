/**
 * Migration Backup Handler
 * Handles backup operations for migrations
 */

import { createLogger } from '../../utils/logger';
import { BackupManager } from './BackupManager';
import type { BackupInfo, StateSchema } from './types';

const logger = createLogger('checklist:migration:backup');

/**
 * Handles backup operations for state migrations
 */
export class MigrationBackupHandler {
  constructor(private backupManager: BackupManager) {}

  /**
   * Create a backup of the current state
   */
  async createBackup(statePath: string, version: string): Promise<string> {
    return this.backupManager.createBackup(statePath, version);
  }

  /**
   * List all available backups
   */
  async listBackups(): Promise<BackupInfo[]> {
    return this.backupManager.listBackups();
  }

  /**
   * Rollback to a specific backup
   */
  async rollback(statePath: string, backupPath: string): Promise<void> {
    logger.info({ msg: 'Starting rollback', backupPath });
    await this.backupManager.rollback(statePath, backupPath);
    logger.info({ msg: 'Rollback completed', backupPath });
  }

  /**
   * Restore state from a backup
   */
  async restoreFromBackup(backupPath: string): Promise<StateSchema> {
    return this.backupManager.restoreBackup(backupPath);
  }

  /**
   * Set maximum number of backups to keep
   */
  setMaxBackups(maxBackups: number): void {
    this.backupManager.setMaxBackups(maxBackups);
  }
}
