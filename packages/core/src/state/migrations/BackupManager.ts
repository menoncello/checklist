import * as path from 'path';
import * as yaml from 'js-yaml';
import { createLogger } from '../../utils/logger';
import { BackupInfo, StateSchema } from './types';

const logger = createLogger('checklist:migration:backup');

export class BackupManager {
  private backupDir: string;
  private maxBackups: number;

  constructor(
    backupDir: string = '.checklist/.backup',
    maxBackups: number = 10
  ) {
    this.backupDir = backupDir;
    this.maxBackups = maxBackups;
  }

  private validateBackupDir(backupDir: string): void {
    // Check for path traversal attempts
    if (
      backupDir.includes('..') ||
      backupDir.includes('/etc/') ||
      backupDir.includes('\\etc\\')
    ) {
      throw new Error('Invalid backup directory path');
    }
  }

  async createBackup(statePath: string, version: string): Promise<string> {
    this.validateBackupDir(this.backupDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `state-v${version}-${timestamp}.yaml`;
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
        .sort((a, b) => {
          const dateA =
            a.createdAt != null ? new Date(a.createdAt).getTime() : 0;
          const dateB =
            b.createdAt != null ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        })
        .slice(0, backups.length - this.maxBackups);

      for (const backup of backupsToDelete) {
        const { unlink } = await import('fs/promises');
        await unlink(backup.path);
        logger.debug({ msg: 'Rotated old backup', path: backup.path });
      }
    } catch (error) {
      logger.warn({ msg: 'Failed to rotate backups', error });
    }
  }

  async listBackups(): Promise<BackupInfo[]> {
    try {
      await this.ensureBackupDir();
      const entries = await this.getBackupEntries();
      const backups = await this.processBackupEntries(entries);
      return this.sortBackupsByDate(backups);
    } catch (error) {
      logger.error({ msg: 'Failed to list backups', error });
      return [];
    }
  }

  private async getBackupEntries(): Promise<string[]> {
    return Array.fromAsync(
      new Bun.Glob('state-*.yaml').scan({ cwd: this.backupDir })
    );
  }

  private async processBackupEntries(entries: string[]): Promise<BackupInfo[]> {
    const backups: BackupInfo[] = [];
    for (const entry of entries) {
      const backup = await this.parseBackupEntry(entry);
      if (backup) {
        backups.push(backup);
      }
    }
    return backups;
  }

  private async parseBackupEntry(entry: string): Promise<BackupInfo | null> {
    const fullPath = path.join(this.backupDir, entry);
    const stat = await Bun.file(fullPath).stat();
    const match = entry.match(
      /state-(v.+)-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/
    );

    if (!match) return null;

    const [, version, timestamp] = match;
    const createdAt = timestamp.replace(
      /T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/,
      'T$1:$2:$3.$4Z'
    );

    return {
      path: fullPath,
      version,
      timestamp: createdAt,
      createdAt,
      size: stat.size,
    };
  }

  private sortBackupsByDate(backups: BackupInfo[]): BackupInfo[] {
    return backups.sort((a, b) => {
      const dateA = a.createdAt != null ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt != null ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
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
      const { mkdir } = await import('fs/promises');
      await mkdir(this.backupDir, { recursive: true });
      await Bun.write(path.join(this.backupDir, '.gitkeep'), '');
    } catch (_error) {
      // Directory creation handled
    }
  }

  async restoreBackup(backupPath: string): Promise<StateSchema> {
    const content = await Bun.file(backupPath).text();
    return yaml.load(content) as StateSchema;
  }

  setMaxBackups(maxBackups: number): void {
    this.maxBackups = maxBackups;
  }
}
