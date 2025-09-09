import { existsSync, mkdirSync, chmodSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createLogger } from '../utils/logger';

const logger = createLogger('checklist:directory');

export class DirectoryManager {
  private baseDir: string;

  constructor(baseDir: string = '.checklist') {
    this.baseDir = resolve(baseDir);
  }

  async initialize(): Promise<void> {
    const directories = [
      { path: this.baseDir, permissions: 0o755 },
      { path: join(this.baseDir, 'backups'), permissions: 0o755 },
      { path: join(this.baseDir, '.locks'), permissions: 0o755 },
      { path: join(this.baseDir, '.cache'), permissions: 0o755 },
      { path: join(this.baseDir, 'logs'), permissions: 0o755 },
    ];

    for (const dir of directories) {
      await this.createDirectory(dir.path, dir.permissions);
    }
  }

  private async createDirectory(
    dirPath: string,
    permissions: number
  ): Promise<void> {
    try {
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
        chmodSync(dirPath, permissions);
      }
    } catch (error) {
      await this.cleanup();
      throw new Error(`Failed to create directory ${dirPath}: ${error}`);
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (existsSync(this.baseDir)) {
        const dirs = [
          join(this.baseDir, '.cache'),
          join(this.baseDir, '.locks'),
          join(this.baseDir, 'logs'),
          join(this.baseDir, 'backups'),
        ];

        for (const dir of dirs) {
          if (existsSync(dir)) {
            const glob = new Bun.Glob('*');
            for await (const file of glob.scan({ cwd: dir, onlyFiles: true })) {
              try {
                const filePath = join(dir, file);
                await Bun.write(filePath, '');
                const { unlink } = await import('fs/promises');
                await unlink(filePath);
              } catch {
                // Ignore file deletion errors during cleanup
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error({ msg: 'Cleanup error', error });
    }
  }

  getBasePath(): string {
    return this.baseDir;
  }

  getBackupPath(): string {
    return join(this.baseDir, 'backups');
  }

  getLockPath(): string {
    return join(this.baseDir, '.locks');
  }

  getCachePath(): string {
    return join(this.baseDir, '.cache');
  }

  getLogPath(): string {
    return join(this.baseDir, 'logs');
  }

  getStatePath(): string {
    return join(this.baseDir, 'state.yaml');
  }
}
