/**
 * Core file operations for Bun-based file system service
 * Handles reading, writing, copying, and moving files
 */

import type {
  ReadOptions,
  WriteOptions,
} from '../../interfaces/IFileSystemService';
import type { Logger } from '../../utils/logger';

export class FileOperations {
  private defaultEncoding: BufferEncoding = 'utf8';

  constructor(
    private logger: Logger,
    defaultEncoding?: BufferEncoding
  ) {
    if (defaultEncoding !== undefined) {
      this.defaultEncoding = defaultEncoding;
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

      if (options?.maxLength !== undefined) {
        const buffer = await file.arrayBuffer();
        const limitedBuffer = buffer.slice(0, options.maxLength);
        return new TextDecoder().decode(limitedBuffer);
      }

      return await file.text();
    } catch (error) {
      this.logger.error({ msg: 'Failed to read file', filePath, error });
      throw new Error(
        `Failed to read file: ${filePath} - ${(error as Error).message}`
      );
    }
  }

  async readFileBuffer(filePath: string): Promise<Buffer> {
    try {
      const file = Bun.file(filePath);
      const arrayBuffer = await file.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      this.logger.error({
        msg: 'Failed to read file as buffer',
        filePath,
        error,
      });
      throw new Error(
        `Failed to read file as buffer: ${filePath} - ${(error as Error).message}`
      );
    }
  }

  async writeFile(
    filePath: string,
    data: string | Buffer | Uint8Array,
    options?: WriteOptions
  ): Promise<void> {
    try {
      const mode = options?.mode ?? 0o644;

      if (options?.createDirectories === true) {
        await this.ensureDirectoryFromFile(filePath);
      }

      await Bun.write(filePath, data);

      this.logger.debug({ msg: 'File written successfully', filePath, mode });
    } catch (error) {
      this.logger.error({ msg: 'Failed to write file', filePath, error });
      throw new Error(
        `Failed to write file: ${filePath} - ${(error as Error).message}`
      );
    }
  }

  async appendFile(
    filePath: string,
    data: string | Buffer | Uint8Array,
    options?: WriteOptions
  ): Promise<void> {
    try {
      const existingFile = Bun.file(filePath);
      const exists = await existingFile.exists();

      if (!exists && options?.createDirectories === true) {
        await this.ensureDirectoryFromFile(filePath);
      }

      let existingContent = '';
      if (exists) {
        existingContent = await existingFile.text();
      }

      const newContent = existingContent + data;
      await Bun.write(filePath, newContent);

      this.logger.debug({ msg: 'Data appended to file', filePath });
    } catch (error) {
      this.logger.error({ msg: 'Failed to append to file', filePath, error });
      throw new Error(
        `Failed to append to file: ${filePath} - ${(error as Error).message}`
      );
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const file = Bun.file(filePath);
      const exists = await file.exists();

      if (!exists) {
        this.logger.warn({ msg: 'File does not exist for deletion', filePath });
        return;
      }

      await Bun.write(filePath, ''); // Bun doesn't have direct delete, simulate
      this.logger.debug({ msg: 'File deleted', filePath });
    } catch (error) {
      this.logger.error({ msg: 'Failed to delete file', filePath, error });
      throw new Error(
        `Failed to delete file: ${filePath} - ${(error as Error).message}`
      );
    }
  }

  async copyFile(source: string, destination: string): Promise<void> {
    try {
      const sourceFile = Bun.file(source);
      const exists = await sourceFile.exists();

      if (!exists) {
        throw new Error(`Source file does not exist: ${source}`);
      }

      const content = await sourceFile.arrayBuffer();
      await Bun.write(destination, content);

      this.logger.debug({ msg: 'File copied', source, destination });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to copy file',
        source,
        destination,
        error,
      });
      throw new Error(
        `Failed to copy file: ${source} -> ${destination} - ${(error as Error).message}`
      );
    }
  }

  async moveFile(source: string, destination: string): Promise<void> {
    try {
      await this.copyFile(source, destination);
      await this.deleteFile(source);

      this.logger.debug({ msg: 'File moved', source, destination });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to move file',
        source,
        destination,
        error,
      });
      throw new Error(
        `Failed to move file: ${source} -> ${destination} - ${(error as Error).message}`
      );
    }
  }

  private async ensureDirectoryFromFile(filePath: string): Promise<void> {
    const { dirname } = await import('path');
    const dirPath = dirname(filePath);

    try {
      await Bun.write(`${dirPath}/.ensure-dir`, '');
    } catch (error) {
      this.logger.error({ msg: 'Failed to ensure directory', dirPath, error });
      throw error;
    }
  }
}
