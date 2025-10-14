/**
 * Disk space checking for Git operations
 */

import { createLogger } from '../../utils/logger';

const logger = createLogger('checklist:templates:git-disk-space');

/**
 * Disk space checker for Git operations
 * Validates sufficient disk space before cloning
 */
export class GitDiskSpaceChecker {
  constructor(private readonly minRequiredBytes: number) {}

  /**
   * Get available disk space in bytes
   */
  private async getAvailableBytes(dir: string): Promise<number | null> {
    const proc = Bun.spawn(['df', '-k', dir], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      return null;
    }

    const output = await new Response(proc.stdout).text();
    const lines = output.split('\n');

    if (lines.length > 1) {
      const parts = lines[1].split(/\s+/);
      const availableKB = parseInt(parts[3], 10);
      return availableKB * 1024;
    }

    return null;
  }

  /**
   * Check if sufficient disk space available
   * @throws Error if insufficient disk space
   */
  async check(): Promise<void> {
    try {
      const homeDir = Bun.env.HOME ?? '~';
      const availableBytes = await this.getAvailableBytes(homeDir);

      if (availableBytes === null) {
        logger.warn({ msg: 'Unable to check disk space, skipping check' });
        return;
      }

      if (availableBytes < this.minRequiredBytes) {
        logger.error({
          msg: 'Insufficient disk space',
          available: availableBytes,
          required: this.minRequiredBytes,
        });
        throw new Error(
          `Insufficient disk space: ${availableBytes} bytes available, need at least ${this.minRequiredBytes} bytes`
        );
      }
    } catch (error) {
      logger.warn({
        msg: 'Error checking disk space, skipping check',
        error: (error as Error).message,
      });
    }
  }
}
