import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import { MAX_BACKUP_COUNT } from './constants';
import { BackupError, RecoveryError, StateCorruptedError } from './errors';
import { ChecklistState, BackupManifest, BackupManifestEntry } from './types';
import { StateValidator } from './validation';

export class BackupManager {
  private backupDir: string;
  private validator: StateValidator;
  private manifestPath: string;

  constructor(backupDirectory: string) {
    this.backupDir = backupDirectory;
    this.manifestPath = join(backupDirectory, 'manifest.yaml');
    this.validator = new StateValidator();
  }

  async initializeManifest(): Promise<void> {
    if (!existsSync(this.manifestPath)) {
      const manifest: BackupManifest = {
        version: '1.0.0',
        backups: [],
        rotationPolicy: {
          maxCount: MAX_BACKUP_COUNT,
        },
      };

      await Bun.write(this.manifestPath, yaml.dump(manifest));
    }
  }

  async createBackup(state: ChecklistState): Promise<string> {
    try {
      const timestamp = Date.now();
      const backupFilename = `state.yaml.${timestamp}`;
      const backupPath = join(this.backupDir, backupFilename);

      const content = yaml.dump(state, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: true,
      });

      await Bun.write(backupPath, content);

      const file = Bun.file(backupPath);
      const size = file.size;

      const entry: BackupManifestEntry = {
        filename: backupFilename,
        createdAt: new Date().toISOString(),
        checksum: state.checksum ?? '',
        size,
        schemaVersion: state.schemaVersion,
      };

      await this.updateManifest(entry);
      await this.rotateBackups();

      return backupPath;
    } catch (error) {
      throw new BackupError(`Failed to create backup: ${error}`);
    }
  }

  private async updateManifest(entry: BackupManifestEntry): Promise<void> {
    const manifest = await this.loadManifest();
    manifest.backups.push(entry);

    manifest.backups.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    await Bun.write(this.manifestPath, yaml.dump(manifest));
  }

  private async loadManifest(): Promise<BackupManifest> {
    try {
      const content = await Bun.file(this.manifestPath).text();
      return yaml.load(content) as BackupManifest;
    } catch {
      return {
        version: '1.0.0',
        backups: [],
        rotationPolicy: {
          maxCount: MAX_BACKUP_COUNT,
        },
      };
    }
  }

  private async rotateBackups(): Promise<void> {
    const manifest = await this.loadManifest();
    const maxCount = manifest.rotationPolicy.maxCount;

    if (manifest.backups.length <= maxCount) {
      return;
    }

    const backupsToDelete = manifest.backups.slice(maxCount);

    for (const backup of backupsToDelete) {
      const backupPath = join(this.backupDir, backup.filename);
      try {
        const file = Bun.file(backupPath);
        if (await file.exists()) {
          await Bun.write(backupPath, '');
          const { unlink } = await import('fs/promises');
          await unlink(backupPath);
        }
      } catch (error) {
        console.error(`Failed to delete old backup ${backup.filename}:`, error);
      }
    }

    manifest.backups = manifest.backups.slice(0, maxCount);
    await Bun.write(this.manifestPath, yaml.dump(manifest));
  }

  async recoverFromLatestBackup(): Promise<ChecklistState> {
    const manifest = await this.loadManifest();

    if (manifest.backups.length === 0) {
      throw new RecoveryError('No backups available for recovery', true);
    }

    for (const backup of manifest.backups) {
      try {
        const state = await this.recoverFromBackup(backup.filename);
        console.log(`Successfully recovered from backup: ${backup.filename}`);
        return state;
      } catch (error) {
        console.error(`Failed to recover from ${backup.filename}:`, error);
        continue;
      }
    }

    throw new RecoveryError('All backup recovery attempts failed', true);
  }

  async recoverFromBackup(filename: string): Promise<ChecklistState> {
    const backupPath = join(this.backupDir, filename);
    const file = Bun.file(backupPath);

    if (!(await file.exists())) {
      throw new RecoveryError(`Backup file not found: ${filename}`, false);
    }

    try {
      const content = await file.text();
      const state = yaml.load(content) as unknown;

      const validatedState = await this.validator.validate(state);

      return validatedState;
    } catch (error) {
      if (error instanceof StateCorruptedError) {
        throw new RecoveryError(
          `Backup ${filename} is corrupted: ${error.message}`,
          false
        );
      }
      throw error;
    }
  }

  async listBackups(): Promise<BackupManifestEntry[]> {
    const manifest = await this.loadManifest();
    return manifest.backups;
  }

  async getBackupInfo(
    filename: string
  ): Promise<BackupManifestEntry | undefined> {
    const manifest = await this.loadManifest();
    return manifest.backups.find((b) => b.filename === filename);
  }

  async cleanupOldBackups(maxAgeMs: number): Promise<number> {
    const manifest = await this.loadManifest();
    const cutoffTime = Date.now() - maxAgeMs;
    let deletedCount = 0;

    const backupsToKeep: BackupManifestEntry[] = [];

    for (const backup of manifest.backups) {
      const backupTime = new Date(backup.createdAt).getTime();

      if (backupTime < cutoffTime) {
        const backupPath = join(this.backupDir, backup.filename);
        try {
          const file = Bun.file(backupPath);
          if (await file.exists()) {
            await Bun.write(backupPath, '');
            const { unlink } = await import('fs/promises');
            await unlink(backupPath);
            deletedCount++;
          }
        } catch (error) {
          console.error(
            `Failed to delete old backup ${backup.filename}:`,
            error
          );
        }
      } else {
        backupsToKeep.push(backup);
      }
    }

    if (deletedCount > 0) {
      manifest.backups = backupsToKeep;
      await Bun.write(this.manifestPath, yaml.dump(manifest));
    }

    return deletedCount;
  }

  async verifyBackup(filename: string): Promise<boolean> {
    try {
      const backupPath = join(this.backupDir, filename);
      const file = Bun.file(backupPath);

      if (!(await file.exists())) {
        return false;
      }

      const content = await file.text();
      const state = yaml.load(content) as unknown;

      await this.validator.validate(state);
      return true;
    } catch {
      return false;
    }
  }

  async verifyAllBackups(): Promise<Map<string, boolean>> {
    const manifest = await this.loadManifest();
    const results = new Map<string, boolean>();

    for (const backup of manifest.backups) {
      const isValid = await this.verifyBackup(backup.filename);
      results.set(backup.filename, isValid);
    }

    return results;
  }
}
