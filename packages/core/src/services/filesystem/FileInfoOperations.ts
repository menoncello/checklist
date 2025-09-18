/**
 * File information operations
 * Handles file metadata and statistics
 */

import { promises as fs } from 'fs';
import type { FileInfo } from '../../interfaces/IFileSystemService';
import type { Logger } from '../../utils/logger';

export class FileInfoOperations {
  constructor(private logger: Logger) {}

  async getFileInfo(filePath: string): Promise<FileInfo> {
    try {
      const stats = await fs.stat(filePath);

      const fileInfo: FileInfo = {
        path: filePath,
        size: stats.size,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        accessedAt: stats.atime,
        permissions: (stats.mode & parseInt('777', 8)).toString(8),
      };

      this.logger.debug({
        msg: 'File info retrieved',
        filePath,
        size: stats.size,
      });

      return fileInfo;
    } catch (error) {
      this.logger.error({ msg: 'Failed to get file info', filePath, error });
      throw new Error(
        `Failed to get file info: ${filePath} - ${(error as Error).message}`
      );
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}
