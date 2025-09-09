import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { watch as fsWatch } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import type {
  IFileSystemService,
  FileInfo,
  ReadOptions,
  WriteOptions,
  WatchOptions,
  FileChangeHandler,
} from '../interfaces/IFileSystemService';
import type { Logger } from '../utils/logger';
import { BaseService, ServiceConfig } from './BaseService';

export interface BunFileSystemConfig extends ServiceConfig {
  tempDirectory?: string;
  defaultEncoding?: BufferEncoding;
}

export class BunFileSystemService
  extends BaseService
  implements IFileSystemService
{
  private tempDir: string;
  private defaultEncoding: BufferEncoding = 'utf8';

  constructor(config: BunFileSystemConfig, logger: Logger) {
    super(config, logger);
    this.tempDir = config.tempDirectory ?? tmpdir();

    if (config.defaultEncoding) {
      this.defaultEncoding = config.defaultEncoding as BufferEncoding;
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      const file = Bun.file(path);
      return await file.exists();
    } catch {
      return false;
    }
  }

  async readFile(filePath: string, options?: ReadOptions): Promise<string> {
    try {
      const file = Bun.file(filePath);
      const encoding = options?.encoding ?? this.defaultEncoding;

      if (encoding === 'utf8') {
        return await file.text();
      } else {
        const buffer = await file.arrayBuffer();
        return Buffer.from(buffer).toString(encoding as BufferEncoding);
      }
    } catch (error) {
      this.logger.error({
        msg: 'Failed to read file',
        path: filePath,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async readFileBuffer(filePath: string): Promise<Buffer> {
    try {
      const file = Bun.file(filePath);
      const arrayBuffer = await file.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      this.logger.error({
        msg: 'Failed to read file buffer',
        path: filePath,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async writeFile(
    filePath: string,
    data: string | Buffer,
    _options?: WriteOptions
  ): Promise<void> {
    try {
      await Bun.write(filePath, data);

      this.logger.debug({
        msg: 'File written',
        path: filePath,
        size: data.length,
      });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to write file',
        path: filePath,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async appendFile(
    filePath: string,
    data: string | Buffer,
    options?: WriteOptions
  ): Promise<void> {
    try {
      const existingContent = (await this.exists(filePath))
        ? await this.readFile(filePath)
        : '';

      const newContent = existingContent + data;
      await this.writeFile(filePath, newContent, options);

      this.logger.debug({
        msg: 'Data appended to file',
        path: filePath,
        appendedSize: data.length,
      });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to append to file',
        path: filePath,
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

  async createDirectory(
    dirPath: string,
    recursive: boolean = true
  ): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive });

      this.logger.debug({
        msg: 'Directory created',
        path: dirPath,
        recursive,
      });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to create directory',
        path: dirPath,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async removeDirectory(
    dirPath: string,
    recursive: boolean = true
  ): Promise<void> {
    try {
      await fs.rm(dirPath, { recursive, force: true });

      this.logger.debug({
        msg: 'Directory removed',
        path: dirPath,
        recursive,
      });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to remove directory',
        path: dirPath,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async readDirectory(dirPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath);

      this.logger.debug({
        msg: 'Directory read',
        path: dirPath,
        entries: entries.length,
      });

      return entries;
    } catch (error) {
      this.logger.error({
        msg: 'Failed to read directory',
        path: dirPath,
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

  async createTempFile(
    prefix: string = 'tmp',
    extension: string = ''
  ): Promise<string> {
    try {
      const filename = `${prefix}-${randomUUID()}${extension}`;
      const tempPath = path.join(this.tempDir, filename);

      await this.writeFile(tempPath, '');

      this.logger.debug({
        msg: 'Temporary file created',
        path: tempPath,
      });

      return tempPath;
    } catch (error) {
      this.logger.error({
        msg: 'Failed to create temporary file',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async createTempDirectory(prefix: string = 'tmp'): Promise<string> {
    try {
      const dirname = `${prefix}-${randomUUID()}`;
      const tempPath = path.join(this.tempDir, dirname);

      await this.createDirectory(tempPath);

      this.logger.debug({
        msg: 'Temporary directory created',
        path: tempPath,
      });

      return tempPath;
    } catch (error) {
      this.logger.error({
        msg: 'Failed to create temporary directory',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  watch(
    filePath: string,
    handler: FileChangeHandler,
    options?: WatchOptions
  ): () => void {
    try {
      const watcher = fsWatch(
        filePath,
        {
          persistent: options?.persistent ?? true,
          recursive: options?.recursive ?? false,
          encoding: (options?.encoding as BufferEncoding) ?? 'utf8',
        },
        (event, filename) => {
          handler(event as 'change' | 'rename', filename ?? '');
        }
      );

      this.logger.debug({
        msg: 'File watcher created',
        path: filePath,
      });

      // Return cleanup function
      return () => {
        watcher.close();
        this.logger.debug({
          msg: 'File watcher closed',
          path: filePath,
        });
      };
    } catch (error) {
      this.logger.error({
        msg: 'Failed to create file watcher',
        path: filePath,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async ensureDirectory(dirPath: string): Promise<void> {
    if (!(await this.exists(dirPath))) {
      await this.createDirectory(dirPath, true);
    }
  }

  async isDirectory(filePath: string): Promise<boolean> {
    try {
      const info = await this.getFileInfo(filePath);
      return info.isDirectory;
    } catch {
      return false;
    }
  }

  async isFile(filePath: string): Promise<boolean> {
    try {
      const info = await this.getFileInfo(filePath);
      return info.isFile;
    } catch {
      return false;
    }
  }

  protected async onInitialize(): Promise<void> {
    // Ensure temp directory exists
    await this.ensureDirectory(this.tempDir);
  }

  protected async onShutdown(): Promise<void> {
    // Clean up any resources if needed
  }
}
