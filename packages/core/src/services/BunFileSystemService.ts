/**
 * Bun-optimized file system service
 * Refactored to use composition pattern with specialized components
 */

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
import { DirectoryOperations } from './filesystem/DirectoryOperations';
import { FileInfoOperations } from './filesystem/FileInfoOperations';
import { FileOperations } from './filesystem/FileOperations';
import { FileWatcher } from './filesystem/FileWatcher';
import { TempFileOperations } from './filesystem/TempFileOperations';

export interface BunFileSystemConfig extends ServiceConfig {
  tempDirectory?: string;
  defaultEncoding?: BufferEncoding;
}

export class BunFileSystemService
  extends BaseService
  implements IFileSystemService
{
  // Composed services
  private fileOps: FileOperations;
  private dirOps: DirectoryOperations;
  private fileInfoOps: FileInfoOperations;
  private tempOps: TempFileOperations;
  private watcher: FileWatcher;

  constructor(config: BunFileSystemConfig, logger: Logger) {
    super(config, logger);

    // Initialize composed services
    this.fileOps = new FileOperations(logger, config.defaultEncoding);
    this.dirOps = new DirectoryOperations(logger);
    this.fileInfoOps = new FileInfoOperations(logger);
    this.tempOps = new TempFileOperations(
      logger,
      this.fileOps,
      this.dirOps,
      config.tempDirectory
    );
    this.watcher = new FileWatcher(logger);
  }

  // File Operations
  async exists(path: string): Promise<boolean> {
    return await this.fileOps.exists(path);
  }

  async readFile(filePath: string, options?: ReadOptions): Promise<string> {
    return await this.fileOps.readFile(filePath, options);
  }

  async readFileBuffer(filePath: string): Promise<Buffer> {
    return await this.fileOps.readFileBuffer(filePath);
  }

  async writeFile(
    filePath: string,
    data: string | Buffer | Uint8Array,
    options?: WriteOptions
  ): Promise<void> {
    await this.fileOps.writeFile(filePath, data, options);
  }

  async appendFile(
    filePath: string,
    data: string | Buffer | Uint8Array,
    options?: WriteOptions
  ): Promise<void> {
    await this.fileOps.appendFile(filePath, data, options);
  }

  async deleteFile(filePath: string): Promise<void> {
    await this.fileOps.deleteFile(filePath);
  }

  async copyFile(source: string, destination: string): Promise<void> {
    await this.fileOps.copyFile(source, destination);
  }

  async moveFile(source: string, destination: string): Promise<void> {
    await this.fileOps.moveFile(source, destination);
  }

  // Directory Operations
  async createDirectory(
    dirPath: string,
    options?: { recursive?: boolean; mode?: number }
  ): Promise<void> {
    await this.dirOps.createDirectory(dirPath, options);
  }

  async removeDirectory(
    dirPath: string,
    options?: { recursive?: boolean; force?: boolean }
  ): Promise<void> {
    await this.dirOps.removeDirectory(dirPath, options);
  }

  async readDirectory(dirPath: string): Promise<string[]> {
    return await this.dirOps.readDirectory(dirPath);
  }

  async ensureDirectory(dirPath: string): Promise<void> {
    await this.dirOps.ensureDirectory(dirPath);
  }

  async isDirectory(filePath: string): Promise<boolean> {
    return await this.dirOps.isDirectory(filePath);
  }

  async isFile(filePath: string): Promise<boolean> {
    return await this.dirOps.isFile(filePath);
  }

  // File Information
  async getFileInfo(filePath: string): Promise<FileInfo> {
    return await this.fileInfoOps.getFileInfo(filePath);
  }

  // Temporary Files
  async createTempFile(
    prefix: string = 'tmp',
    extension: string = '.tmp',
    content?: string | Buffer
  ): Promise<string> {
    return await this.tempOps.createTempFile(prefix, extension, content);
  }

  async createTempDirectory(prefix: string = 'tmp'): Promise<string> {
    return await this.tempOps.createTempDirectory(prefix);
  }

  // File Watching
  watchFile(
    filePath: string,
    handler: FileChangeHandler,
    options?: WatchOptions
  ): () => void {
    return this.watcher.watchFile(filePath, handler, options);
  }
}