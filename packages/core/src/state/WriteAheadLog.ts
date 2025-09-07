import { existsSync, mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import createDebug from 'debug';

const debug = createDebug('checklist:wal');

export interface WALEntry {
  timestamp: number;
  op: 'write' | 'delete';
  key: string;
  value?: unknown;
  previousValue?: unknown;
  transactionId?: string;
}

export class WriteAheadLog {
  private walPath: string;
  private entries: WALEntry[] = [];
  private isReplaying = false;

  constructor(stateDirectory: string) {
    const walDir = join(stateDirectory, '.wal');
    if (!existsSync(walDir)) {
      mkdirSync(walDir, { recursive: true });
    }
    this.walPath = join(walDir, 'wal.log');
    debug('WAL initialized at %s', this.walPath);
  }

  async append(entry: Omit<WALEntry, 'timestamp'>): Promise<void> {
    const startTime = performance.now();
    const fullEntry: WALEntry = { ...entry, timestamp: Date.now() };
    this.entries.push(fullEntry);

    try {
      const entryLine = JSON.stringify(fullEntry) + '\n';

      // Check if file exists first
      const file = Bun.file(this.walPath);
      if (await file.exists()) {
        // File exists, read current content and append
        const currentContent = await file.text();
        await Bun.write(this.walPath, currentContent + entryLine);
      } else {
        // File doesn't exist, create it
        await Bun.write(this.walPath, entryLine);
      }

      const duration = performance.now() - startTime;
      debug('WAL append completed in %dms', duration);

      if (duration > 10) {
        console.warn(`WAL append took ${duration}ms, exceeding 10ms target`);
      }
    } catch (error) {
      debug('WAL append failed: %O', error);
      throw new Error(`Failed to append to WAL: ${error}`);
    }
  }

  async replay(): Promise<WALEntry[]> {
    if (this.isReplaying) {
      debug('WAL replay already in progress');
      return this.entries;
    }

    const startTime = performance.now();
    this.isReplaying = true;

    try {
      const file = Bun.file(this.walPath);
      if (!(await file.exists())) {
        debug('No WAL file found for replay');
        return [];
      }

      const content = await file.text();
      if (!content.trim()) {
        debug('WAL file is empty');
        return [];
      }

      const lines = content.split('\n').filter(Boolean);
      const entries: WALEntry[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as WALEntry;
          entries.push(entry);
          debug('Replaying WAL entry: %O', entry);
        } catch (parseError) {
          if (line.trim()) {
            console.warn(
              'Failed to parse WAL entry, skipping:',
              line.substring(0, 50)
            );
            debug('WAL parse error: %O', parseError);
          }
        }
      }

      const duration = performance.now() - startTime;
      debug(
        'WAL replay completed in %dms with %d entries',
        duration,
        entries.length
      );

      if (duration > 100) {
        console.warn(`WAL replay took ${duration}ms, exceeding 100ms target`);
      }

      this.entries = entries;
      return entries;
    } catch (error) {
      debug('WAL replay failed: %O', error);
      throw new Error(`Failed to replay WAL: ${error}`);
    } finally {
      this.isReplaying = false;
    }
  }

  async clear(): Promise<void> {
    const startTime = performance.now();

    try {
      this.entries = [];

      const file = Bun.file(this.walPath);
      if (await file.exists()) {
        await unlink(this.walPath);
      }

      const duration = performance.now() - startTime;
      debug('WAL cleared in %dms', duration);

      if (duration > 5) {
        console.warn(`WAL clear took ${duration}ms, exceeding 5ms target`);
      }
    } catch (error) {
      debug('WAL clear failed: %O', error);
      throw new Error(`Failed to clear WAL: ${error}`);
    }
  }

  async getEntries(): Promise<WALEntry[]> {
    return [...this.entries];
  }

  async exists(): Promise<boolean> {
    const file = Bun.file(this.walPath);
    return await file.exists();
  }

  async size(): Promise<number> {
    try {
      const file = Bun.file(this.walPath);
      if (await file.exists()) {
        return file.size;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = this.walPath.replace('.log', `-${timestamp}.backup`);

    try {
      const file = Bun.file(this.walPath);
      if (await file.exists()) {
        const content = await file.text();
        await Bun.write(backupPath, content);
        debug('WAL backup created at %s', backupPath);
      }
      return backupPath;
    } catch (error) {
      debug('WAL backup failed: %O', error);
      throw new Error(`Failed to create WAL backup: ${error}`);
    }
  }

  async applyEntry(
    entry: WALEntry,
    applyFn: (entry: WALEntry) => Promise<void>
  ): Promise<void> {
    try {
      await applyFn(entry);
      debug('Applied WAL entry: %O', entry);
    } catch (error) {
      debug('Failed to apply WAL entry: %O', error);
      throw new Error(`Failed to apply WAL entry: ${error}`);
    }
  }

  async rotate(maxSize: number = 10 * 1024 * 1024): Promise<void> {
    const currentSize = await this.size();

    if (currentSize > maxSize) {
      await this.createBackup();
      await this.clear();
      debug('WAL rotated at size %d bytes', currentSize);
    }
  }
}
