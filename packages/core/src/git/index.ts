/**
 * Git integration utilities
 */

import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
  isClean: boolean;
}

export interface GitRemote {
  name: string;
  url: string;
  type: 'fetch' | 'push';
}

/**
 * Git integration class
 */
export class GitIntegration {
  constructor(private repoPath: string = process.cwd()) {}

  /**
   * Check if directory is a git repository
   */
  async isGitRepo(): Promise<boolean> {
    try {
      const gitDir = path.join(this.repoPath, '.git');
      const stats = await fs.promises.stat(gitDir);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Execute git command
   */
  private async exec(args: string[]): Promise<string> {
    try {
      const { stdout } = await execAsync(`git ${args.join(' ')}`, {
        cwd: this.repoPath,
      });
      return stdout.trim();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Git command failed: ${errorMessage}`);
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    try {
      return await this.exec(['rev-parse', '--abbrev-ref', 'HEAD']);
    } catch {
      return 'HEAD';
    }
  }

  /**
   * Get repository status
   */
  async getStatus(): Promise<GitStatus> {
    const branch = await this.getCurrentBranch();
    const { ahead, behind } = await this.getAheadBehindCounts();
    const { staged, modified, untracked } = await this.getFileStatuses();

    return {
      branch,
      ahead,
      behind,
      staged,
      modified,
      untracked,
      isClean:
        staged.length === 0 && modified.length === 0 && untracked.length === 0,
    };
  }

  private async getAheadBehindCounts(): Promise<{
    ahead: number;
    behind: number;
  }> {
    try {
      const counts = await this.exec([
        'rev-list',
        '--left-right',
        '--count',
        'HEAD...@{u}',
      ]);
      const [a, b] = counts.split('\t').map(Number);
      return { ahead: a ?? 0, behind: b ?? 0 };
    } catch {
      return { ahead: 0, behind: 0 };
    }
  }

  private async getFileStatuses(): Promise<{
    staged: string[];
    modified: string[];
    untracked: string[];
  }> {
    const statusOutput = await this.exec(['status', '--porcelain=v1']);
    const lines = statusOutput.split('\n').filter(Boolean);

    return this.categorizeFileStatuses(lines);
  }

  private categorizeFileStatuses(lines: string[]): {
    staged: string[];
    modified: string[];
    untracked: string[];
  } {
    const staged: string[] = [];
    const modified: string[] = [];
    const untracked: string[] = [];

    for (const line of lines) {
      const status = line.substring(0, 2);
      const file = line.substring(3);

      this.categorizeFileByStatus({
        status,
        file,
        categories: { staged, modified, untracked },
      });
    }

    return { staged, modified, untracked };
  }

  private categorizeFileByStatus(config: {
    status: string;
    file: string;
    categories: {
      staged: string[];
      modified: string[];
      untracked: string[];
    };
  }): void {
    const { status, file, categories } = config;
    const { staged, modified, untracked } = categories;

    if (status[0] !== ' ' && status[0] !== '?') {
      staged.push(file);
    }
    if (status[1] !== ' ' && status[1] !== '?') {
      modified.push(file);
    }
    if (status === '??') {
      untracked.push(file);
    }
  }

  /**
   * Get list of remotes
   */
  async getRemotes(): Promise<GitRemote[]> {
    const output = await this.exec(['remote', '-v']);
    const lines = output.split('\n').filter(Boolean);

    return lines.map((line) => {
      const [name, url, type] = line.split(/\s+/);
      return {
        name: name ?? '',
        url: url ?? '',
        type: type?.includes('push') ? 'push' : 'fetch',
      };
    });
  }

  /**
   * Get commit hash for HEAD
   */
  async getHeadCommit(): Promise<string> {
    return await this.exec(['rev-parse', 'HEAD']);
  }

  /**
   * Get list of changed files between commits
   */
  async getDiff(from?: string, to = 'HEAD'): Promise<string[]> {
    const args = ['diff', '--name-only'];
    if (from !== null && from !== undefined && from !== '') {
      args.push(`${from}..${to}`);
    }

    const output = await this.exec(args);
    return output.split('\n').filter(Boolean);
  }

  /**
   * Check if file is ignored
   */
  async isIgnored(filePath: string): Promise<boolean> {
    try {
      await this.exec(['check-ignore', filePath]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get repository root path
   */
  async getRepoRoot(): Promise<string> {
    return await this.exec(['rev-parse', '--show-toplevel']);
  }

  /**
   * Stage files
   */
  async add(files: string[]): Promise<void> {
    if (files.length === 0) return;
    await this.exec(['add', ...files]);
  }

  /**
   * Create commit
   */
  async commit(message: string): Promise<string> {
    await this.exec(['commit', '-m', message]);
    return await this.getHeadCommit();
  }

  /**
   * Get log entries
   */
  async getLog(limit = 10): Promise<
    Array<{
      hash: string;
      author: string;
      date: string;
      message: string;
    }>
  > {
    const format = '%H|%an|%ai|%s';
    const output = await this.exec([
      'log',
      `--max-count=${limit}`,
      `--format=${format}`,
    ]);

    return output
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, author, date, ...messageParts] = line.split('|');
        return {
          hash: hash ?? '',
          author: author ?? '',
          date: date ?? '',
          message: messageParts.join('|'),
        };
      });
  }
}
