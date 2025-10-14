/**
 * Git-based template repository implementation
 * Handles cloning, updating, and managing template repositories
 */

import { createLogger } from '../../utils/logger';
import { GitDiskSpaceChecker } from './GitDiskSpaceChecker';
import { GitRateLimiter } from './GitRateLimiter';
import { createConfig } from './GitRepositoryConfig';
import type { GitRepositoryConfig } from './GitRepositoryConfig';
import {
  RepositorySecurityError,
  validateRepositoryUrl,
} from './RepositoryUrlValidator';
import {
  isNonTransientError,
  calculateBackoffDelay,
  waitFor,
  logRetryAttempt,
  logNonTransientError,
  logFinalFailure,
} from './RetryHelper';

const logger = createLogger('checklist:templates:git-repository');

// Re-export for convenience
export { RepositorySecurityError, validateRepositoryUrl };
export type { GitRepositoryConfig };

/**
 * Git repository manager for template marketplace
 * Handles cloning, caching, and version management of Git repositories
 */
export class GitTemplateRepository {
  private readonly cacheDir = '~/.bmad/cache/templates/';
  private readonly config: Required<GitRepositoryConfig>;
  private readonly rateLimiter: GitRateLimiter;
  private readonly diskSpaceChecker: GitDiskSpaceChecker;

  constructor(
    private readonly repositoryUrl: string,
    config?: GitRepositoryConfig
  ) {
    validateRepositoryUrl(repositoryUrl);
    this.config = createConfig(config);
    this.rateLimiter = new GitRateLimiter(this.config.maxClonesPerMinute);
    this.diskSpaceChecker = new GitDiskSpaceChecker(this.config.maxRepoSize);
  }

  /**
   * Clone repository to target directory with resource limits and retry logic
   * @param targetDir - Target directory for cloning
   * @throws Error if clone fails or limits exceeded after all retries
   */
  async clone(targetDir: string): Promise<void> {
    this.rateLimiter.check();
    await this.diskSpaceChecker.check();

    logger.info({
      msg: 'Cloning template repository',
      url: this.repositoryUrl,
      target: targetDir,
      timeout: this.config.cloneTimeout,
    });

    await this.retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = this.createCloneTimeout(controller);

      try {
        await this.executeClone(targetDir, controller.signal);
        this.rateLimiter.record();

        logger.info({
          msg: 'Repository cloned successfully',
          target: targetDir,
        });
      } catch (error) {
        await this.handleCloneError(error, targetDir, controller.signal);
      } finally {
        clearTimeout(timeoutId);
      }
    });
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryWithBackoff(
    operation: () => Promise<void>
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        await operation();
        return;
      } catch (error) {
        lastError = error as Error;

        if (isNonTransientError(error)) {
          logNonTransientError(attempt, lastError);
          throw lastError;
        }

        const isLastAttempt = attempt === this.config.maxRetries - 1;
        if (isLastAttempt) {
          logFinalFailure(this.config.maxRetries, lastError);
          throw lastError;
        }

        const delay = calculateBackoffDelay(attempt, this.config.retryDelay);
        logRetryAttempt(attempt, this.config.maxRetries, lastError, delay);
        await waitFor(delay);
      }
    }

    throw lastError ?? new Error('Clone failed after all retries');
  }

  /**
   * Create timeout handler for clone operation
   */
  private createCloneTimeout(controller: AbortController): Timer {
    return setTimeout(() => {
      controller.abort();
      logger.error({
        msg: 'Clone operation timed out',
        url: this.repositoryUrl,
        timeout: this.config.cloneTimeout,
      });
    }, this.config.cloneTimeout);
  }

  /**
   * Execute Git clone operation
   */
  private async executeClone(
    targetDir: string,
    signal: AbortSignal
  ): Promise<void> {
    const proc = Bun.spawn(
      ['git', 'clone', '--depth=1', this.repositoryUrl, targetDir],
      {
        stdout: 'pipe',
        stderr: 'pipe',
        signal,
      }
    );

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`Git clone failed: ${stderr}`);
    }
  }

  /**
   * Handle clone operation errors
   */
  private async handleCloneError(
    error: unknown,
    targetDir: string,
    signal: AbortSignal
  ): Promise<never> {
    if (signal.aborted) {
      await this.cleanupFailedClone(targetDir);
      throw new Error(
        `Clone operation timed out after ${this.config.cloneTimeout}ms`
      );
    }

    logger.error({
      msg: 'Failed to clone repository',
      url: this.repositoryUrl,
      error: (error as Error).message,
    });

    await this.cleanupFailedClone(targetDir);
    throw error as Error;
  }

  /**
   * Cleanup failed clone operation
   * Never throws - logs errors but continues
   */
  private async cleanupFailedClone(targetDir: string): Promise<void> {
    try {
      logger.info({
        msg: 'Cleaning up failed clone',
        path: targetDir,
      });

      const dirExists = await Bun.file(`${targetDir}/.git/config`).exists();
      if (!dirExists) {
        logger.debug({
          msg: 'Clone directory does not exist, no cleanup needed',
        });
        return;
      }

      await this.removeDirectory(targetDir);

      logger.info({
        msg: 'Clone directory cleaned up successfully',
        path: targetDir,
      });
    } catch (cleanupError) {
      logger.warn({
        msg: 'Exception during cleanup',
        path: targetDir,
        error: (cleanupError as Error).message,
      });
    }
  }

  /**
   * Remove directory recursively
   */
  private async removeDirectory(path: string): Promise<void> {
    const proc = Bun.spawn(['rm', '-rf', path], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      logger.warn({
        msg: 'Failed to cleanup clone directory',
        path,
        error: stderr,
      });
    }
  }

  /**
   * Validate that path is a valid Git repository
   * @param path - Path to validate
   * @throws Error if path is not a valid Git repository
   */
  private async validateGitRepository(path: string): Promise<void> {
    const gitConfigPath = `${path}/.git/config`;
    const isGitRepo = await Bun.file(gitConfigPath).exists();

    if (!isGitRepo) {
      const error = new Error(`Path is not a valid Git repository: ${path}`);
      logger.error({
        msg: 'Not a valid Git repository',
        path,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Fetch repository updates
   * @param localPath - Local repository path
   */
  async fetch(localPath: string): Promise<void> {
    logger.info({
      msg: 'Fetching repository updates',
      path: localPath,
    });

    await this.validateGitRepository(localPath);

    try {
      const proc = Bun.spawn(['git', '-C', localPath, 'pull', '--ff-only'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        throw new Error(`Git fetch failed: ${stderr}`);
      }

      logger.info({
        msg: 'Repository updated successfully',
        path: localPath,
      });
    } catch (error) {
      logger.error({
        msg: 'Failed to fetch repository updates',
        path: localPath,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * List available versions from Git tags
   * @returns Array of version tags (latest first)
   */
  async listVersions(): Promise<string[]> {
    const cacheKey = this.getRepoCacheKey();
    const cachedPath = `${this.cacheDir}${cacheKey}`;

    if (!(await Bun.file(cachedPath).exists())) {
      await this.clone(cachedPath);
    }

    const proc = Bun.spawn(['git', '-C', cachedPath, 'tag', '--list'], {
      stdout: 'pipe',
    });

    const output = await new Response(proc.stdout).text();
    const versions = output
      .split('\n')
      .filter((v) => v.length > 0)
      .sort()
      .reverse();

    return versions;
  }

  /**
   * Validate repository structure
   * @param path - Repository path to validate
   * @returns True if valid, false otherwise
   */
  async validateStructure(path: string): Promise<boolean> {
    const manifestPath = `${path}/template.json`;
    const manifestExists = await Bun.file(manifestPath).exists();

    if (!manifestExists) {
      logger.error({
        msg: 'Repository missing template.json',
        path,
      });
      return false;
    }

    return true;
  }

  /**
   * Generate cache key from repository URL
   */
  private getRepoCacheKey(): string {
    return Buffer.from(this.repositoryUrl).toString('base64');
  }
}
