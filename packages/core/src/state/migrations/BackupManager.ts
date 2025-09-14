import * as path from 'path';
import * as yaml from 'js-yaml';
import { createLogger } from '../../utils/logger';
import { BackupInfo, StateSchema } from './types';

const logger = createLogger('checklist:migration:backup');

export class BackupManager {
  private backupDir: string;
  private maxBackups: number;

  constructor(backupDir: string = '.checklist/.backup', maxBackups: number = 10) {
    this.backupDir = backupDir;
    this.maxBackups = maxBackups;
  }

  async createBackup(statePath: string, version: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `state-${version}-${timestamp}.yaml`;
    const backupPath = path.join(this.backupDir, backupFilename);

    try {
      await this.ensureBackupDir();

      const state = await this.loadState(statePath);
      const backupContent = yaml.dump(state, { indent: 2, lineWidth: -1 });

      await Bun.write(backupPath, backupContent);
      await this.rotateBackups();

      logger.info({
        msg: 'Backup created successfully',
        backupPath,
        originalPath: statePath,
        version,
      });

      return backupPath;
    } catch (error) {
      logger.error({
        msg: 'Failed to create backup',
        error,
        backupPath,
        originalPath: statePath,
      });
      throw new Error(`Backup creation failed: ${(error as Error).message}`);
    }
  }

  private async rotateBackups(): Promise<void> {
    try {
      const backups = await this.listBackups();
      if (backups.length <= this.maxBackups) return;

      const backupsToDelete = backups
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(0, backups.length - this.maxBackups);

      for (const backup of backupsToDelete) {
        await Bun.write(backup.path, ''); // Delete file content
        logger.debug({ msg: 'Rotated old backup', path: backup.path });
      }
    } catch (error) {
      logger.warn({ msg: 'Failed to rotate backups', error });
    }
  }

  async listBackups(): Promise<BackupInfo[]> {
    try {
      await this.ensureBackupDir();
      const entries = await Array.fromAsync(
        new Bun.Glob('state-*.yaml').scan({ cwd: this.backupDir })
      );

      const backups: BackupInfo[] = [];
      for (const entry of entries) {
        const fullPath = path.join(this.backupDir, entry);
        const stat = await Bun.file(fullPath).stat();

        const match = entry.match(/state-(.+)-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
        if (match) {
          const [, version, timestamp] = match;
          const createdAt = new Date(timestamp.replace(/-/g, ':').replace(/T(\d{2}):(\d{2}):(\d{2})/, 'T$1:$2:$3'));

          backups.push({
            path: fullPath,
            version,
            createdAt,
            size: stat.size,
          });
        }
      }

      return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      logger.error({ msg: 'Failed to list backups', error });
      return [];
    }
  }

  async rollback(statePath: string, backupPath: string): Promise<void> {
    try {
      const backupFile = Bun.file(backupPath);
      if (!(await backupFile.exists())) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }

      const backupContent = await backupFile.text();
      await Bun.write(statePath, backupContent);

      logger.info({
        msg: 'Rollback completed successfully',
        statePath,
        backupPath,
      });
    } catch (error) {
      logger.error({
        msg: 'Rollback failed',
        error,
        statePath,
        backupPath,
      });
      throw new Error(`Rollback failed: ${(error as Error).message}`);
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

  private async ensureBackupDir(): Promise<void> {
    try {
      await Bun.write(path.join(this.backupDir, '.gitkeep'), '');
    } catch (_error) {
      // Directory creation handled by Bun.write
    }
  }
}