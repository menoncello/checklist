import { existsSync, mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * Manages WAL file operations
 */
export class WALFileManager {
  private walPath: string;
  private readonly stateDirectory: string;

  constructor(stateDirectory: string) {
    this.stateDirectory = this.validateAndSanitizeDirectory(stateDirectory);
    this.walPath = this.initializeWalPath();
  }

  /**
   * Validate and sanitize directory path to prevent traversal
   */
  private validateAndSanitizeDirectory(stateDirectory: string): string {
    const sanitizedDir = resolve(stateDirectory);
    const expectedBase = resolve(process.cwd());
    const tempBase = resolve('/tmp');
    const osTemp = resolve(require('node:os').tmpdir());

    // Allow project root, /tmp, and OS temp directory for testing
    const isValidPath =
      sanitizedDir.startsWith(expectedBase) ||
      sanitizedDir.startsWith(tempBase) ||
      sanitizedDir.startsWith(osTemp);

    if (!isValidPath) {
      throw new Error(
        `Invalid state directory: ${stateDirectory} is outside project root`
      );
    }

    return sanitizedDir;
  }

  /**
   * Initialize WAL directory and return path
   */
  private initializeWalPath(): string {
    const walDir = join(this.stateDirectory, '.wal');
    if (!existsSync(walDir)) {
      mkdirSync(walDir, { recursive: true });
    }
    return join(walDir, 'wal.log');
  }

  /**
   * Get WAL file path
   */
  getWalPath(): string {
    return this.walPath;
  }

  /**
   * Check if WAL file exists
   */
  async exists(): Promise<boolean> {
    const file = Bun.file(this.walPath);
    return await file.exists();
  }

  /**
   * Read WAL file contents
   */
  async readFile(): Promise<string> {
    const file = Bun.file(this.walPath);
    return await file.text();
  }

  /**
   * Write content to WAL file
   */
  async writeFile(content: string): Promise<void> {
    await Bun.write(this.walPath, content);
  }

  /**
   * Clear WAL file
   */
  async clearFile(): Promise<void> {
    const file = Bun.file(this.walPath);
    if (await file.exists()) {
      await unlink(this.walPath);
    }
  }

  /**
   * Get file stats
   */
  async getFileStats(): Promise<{ size: number; mtime: Date }> {
    const file = Bun.file(this.walPath);
    if (await file.exists()) {
      const stat = await file.stat();
      return {
        size: stat.size,
        mtime: stat.mtime,
      };
    }
    return { size: 0, mtime: new Date() };
  }

  /**
   * Delete WAL file
   */
  async delete(): Promise<void> {
    if (await this.exists()) {
      await unlink(this.walPath);
    }
  }
}
