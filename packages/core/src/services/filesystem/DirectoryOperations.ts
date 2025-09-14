/**
 * Directory operations for Bun-based file system service
 * Handles directory creation, removal, and listing
 */

import { promises as fs } from 'fs';
import type { Logger } from '../../utils/logger';

export class DirectoryOperations {
  constructor(private logger: Logger) {}

  async createDirectory(
    dirPath: string,
    options?: { recursive?: boolean; mode?: number }
  ): Promise<void> {
    try {
      const recursive = options?.recursive ?? true;
      const mode = options?.mode ?? 0o755;

      await fs.mkdir(dirPath, { recursive, mode });

      this.logger.debug({ msg: 'Directory created', dirPath, recursive, mode });
    } catch (error) {
      this.logger.error({ msg: 'Failed to create directory', dirPath, error });
      throw new Error(`Failed to create directory: ${dirPath} - ${(error as Error).message}`);
    }
  }

  async removeDirectory(
    dirPath: string,
    options?: { recursive?: boolean; force?: boolean }
  ): Promise<void> {
    try {
      const recursive = options?.recursive ?? false;
      const force = options?.force ?? false;

      await fs.rmdir(dirPath, { recursive });

      this.logger.debug({ msg: 'Directory removed', dirPath, recursive, force });
    } catch (error) {
      this.logger.error({ msg: 'Failed to remove directory', dirPath, error });
      throw new Error(`Failed to remove directory: ${dirPath} - ${(error as Error).message}`);
    }
  }

  async readDirectory(dirPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath);

      this.logger.debug({
        msg: 'Directory read',
        dirPath,
        entryCount: entries.length,
      });

      return entries;
    } catch (error) {
      this.logger.error({ msg: 'Failed to read directory', dirPath, error });
      throw new Error(`Failed to read directory: ${dirPath} - ${(error as Error).message}`);
    }
  }

  async ensureDirectory(dirPath: string): Promise<void> {
    await this.createDirectory(dirPath, { recursive: true });
  }

  async isDirectory(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  async isFile(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }
}