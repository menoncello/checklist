import type { BackupManager } from './BackupManager';
import { MigrationResult } from './types';

export class MigrationRunnerHelpers {
  static async createBackupIfNeeded(
    createBackup: boolean,
    statePath: string,
    fromVersion: string,
    backupManager: BackupManager
  ): Promise<string | undefined> {
    if (!createBackup) return undefined;
    const file = Bun.file(statePath);
    if (await file.exists()) {
      return await backupManager.createBackup(statePath, fromVersion);
    }
    return undefined;
  }

  static buildSuccessResult(
    fromVersion: unknown,
    toVersion: unknown,
    appliedMigrations: string[],
    backupPath?: string
  ): MigrationResult {
    return {
      success: true,
      fromVersion: fromVersion as string,
      toVersion: toVersion as string,
      appliedMigrations,
      backupPath,
    };
  }

  static buildFailureResult(
    fromVersion: unknown,
    toVersion: unknown,
    error: Error,
    backupPath?: string
  ): MigrationResult {
    return {
      success: false,
      fromVersion: fromVersion as string,
      toVersion: toVersion as string,
      appliedMigrations: [],
      error,
      backupPath,
    };
  }

  static checkForEarlyReturn(
    fromVersion: string,
    toVersion: string
  ): MigrationResult | null {
    if (fromVersion === toVersion) {
      return {
        success: true,
        fromVersion,
        toVersion,
        appliedMigrations: [],
      };
    }
    return null;
  }
}
