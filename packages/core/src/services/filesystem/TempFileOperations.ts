/**
 * Temporary file and directory operations
 * Handles creation and management of temporary files
 */

import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import * as path from 'path';
import type { Logger } from '../../utils/logger';
import { DirectoryOperations } from './DirectoryOperations';
import { FileOperations } from './FileOperations';

export class TempFileOperations {
  private tempDir: string;

  constructor(
    private logger: Logger,
    private fileOps: FileOperations,
    private dirOps: DirectoryOperations,
    tempDirectory?: string
  ) {
    this.tempDir = tempDirectory ?? tmpdir();
  }

  async createTempFile(
    prefix: string = 'tmp',
    extension: string = '.tmp',
    content?: string | Buffer
  ): Promise<string> {
    try {
      const filename = `${prefix}-${randomUUID()}${extension}`;
      const tempPath = path.join(this.tempDir, filename);

      if (content !== undefined) {
        await this.fileOps.writeFile(tempPath, content);
      } else {
        await this.fileOps.writeFile(tempPath, '');
      }

      this.logger.debug({ msg: 'Temporary file created', tempPath });

      return tempPath;
    } catch (error) {
      this.logger.error({
        msg: 'Failed to create temporary file',
        prefix,
        extension,
        error,
      });
      throw new Error(
        `Failed to create temporary file: ${(error as Error).message}`
      );
    }
  }

  async createTempDirectory(prefix: string = 'tmp'): Promise<string> {
    try {
      const dirName = `${prefix}-${randomUUID()}`;
      const tempPath = path.join(this.tempDir, dirName);

      await this.dirOps.createDirectory(tempPath, { recursive: true });

      this.logger.debug({ msg: 'Temporary directory created', tempPath });

      return tempPath;
    } catch (error) {
      this.logger.error({
        msg: 'Failed to create temporary directory',
        prefix,
        error,
      });
      throw new Error(
        `Failed to create temporary directory: ${(error as Error).message}`
      );
    }
  }
}
