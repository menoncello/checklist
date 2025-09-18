import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import type { FileInfo } from '../interfaces/IFileSystemService';
import type { Logger } from '../utils/logger';

export class FileOperations {
  constructor(
    private logger: Logger,
    private tempDir: string = tmpdir()
  ) {}

  async copyFile(source: string, destination: string): Promise<void> {
    try {
      await fs.copyFile(source, destination);

      this.logger.debug({
        msg: 'File copied',
        source,
        destination,
      });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to copy file',
        source,
        destination,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async moveFile(source: string, destination: string): Promise<void> {
    try {
      await fs.rename(source, destination);

      this.logger.debug({
        msg: 'File moved',
        source,
        destination,
      });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to move file',
        source,
        destination,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);

      this.logger.debug({
        msg: 'File deleted',
        path: filePath,
      });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to delete file',
        path: filePath,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async getFileInfo(filePath: string): Promise<FileInfo> {
    try {
      const stats = await fs.stat(filePath);

      return {
        path: filePath,
        size: stats.size,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        permissions: stats.mode.toString(8),
      };
    } catch (error) {
      this.logger.error({
        msg: 'Failed to get file info',
        path: filePath,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async createTempFile(content: string, extension?: string): Promise<string> {
    try {
      const fileName = `${randomUUID()}${extension ?? '.tmp'}`;
      const filePath = path.join(this.tempDir, fileName);

      await fs.writeFile(filePath, content, 'utf8');

      this.logger.debug({
        msg: 'Temporary file created',
        path: filePath,
      });

      return filePath;
    } catch (error) {
      this.logger.error({
        msg: 'Failed to create temporary file',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async createTempDirectory(): Promise<string> {
    try {
      const dirName = randomUUID();
      const dirPath = path.join(this.tempDir, dirName);

      await fs.mkdir(dirPath, { recursive: true });

      this.logger.debug({
        msg: 'Temporary directory created',
        path: dirPath,
      });

      return dirPath;
    } catch (error) {
      this.logger.error({
        msg: 'Failed to create temporary directory',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async cleanupTemp(tempPath: string): Promise<void> {
    try {
      const stats = await fs.stat(tempPath);

      if (stats.isDirectory()) {
        await fs.rm(tempPath, { recursive: true, force: true });
      } else {
        await fs.unlink(tempPath);
      }

      this.logger.debug({
        msg: 'Temporary file/directory cleaned up',
        path: tempPath,
      });
    } catch (error) {
      this.logger.warn({
        msg: 'Failed to cleanup temporary file/directory',
        path: tempPath,
        error: (error as Error).message,
      });
    }
  }
}
