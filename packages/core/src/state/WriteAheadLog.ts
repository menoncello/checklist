import { existsSync, mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
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
  private lastWriteTime = 0;
  private writeCount = 0;
  private readonly rateWindow = 1000; // 1 second window
  private readonly maxWritesPerWindow = 100; // Max writes per window
  private readonly stateDirectory: string;

  constructor(stateDirectory: string) {
    // Validate and sanitize directory path to prevent traversal
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

    this.stateDirectory = sanitizedDir;
    const walDir = join(sanitizedDir, '.wal');
    if (!existsSync(walDir)) {
      mkdirSync(walDir, { recursive: true });
    }
    this.walPath = join(walDir, 'wal.log');
    debug('WAL initialized at %s', this.walPath);
  }

  async append(entry: Omit<WALEntry, 'timestamp'>): Promise<void> {
    const startTime = performance.now();

    // Implement rate limiting
    const now = Date.now();
    if (now - this.lastWriteTime > this.rateWindow) {
      // New window, reset counter
      this.writeCount = 0;
      this.lastWriteTime = now;
    }

    this.writeCount++;
    if (this.writeCount > this.maxWritesPerWindow) {
      const waitTime = this.rateWindow - (now - this.lastWriteTime);
      debug('Rate limit exceeded, waiting %dms', waitTime);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.writeCount = 1;
      this.lastWriteTime = Date.now();
    }

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

      // Optimize for large WALs with parallel parsing
      const batchSize = lines.length > 50 ? 25 : 10; // Larger batches for big WALs
      const batches: string[][] = [];

      // Split into batches
      for (let i = 0; i < lines.length; i += batchSize) {
        batches.push(lines.slice(i, Math.min(i + batchSize, lines.length)));
      }

      // Process batches in parallel for large WALs
      if (lines.length > 50) {
        // Parallel processing for large WALs
        const parsedBatches = await Promise.all(
          batches.map(async (batch) => {
            return batch
              .map((line) => {
                try {
                  if (line.trim()) {
                    return JSON.parse(line) as WALEntry;
                  }
                  return null;
                } catch {
                  if (line.trim()) {
                    debug(
                      'WAL parse error for line: %s',
                      line.substring(0, 50)
                    );
                  }
                  return null;
                }
              })
              .filter((entry): entry is WALEntry => entry !== null);
          })
        );

        // Flatten results
        for (const batchEntries of parsedBatches) {
          entries.push(...batchEntries);
        }
      } else {
        // Sequential processing for small WALs (maintains order)
        for (const batch of batches) {
          const batchEntries = batch
            .map((line) => {
              try {
                if (line.trim()) {
                  return JSON.parse(line) as WALEntry;
                }
                return null;
              } catch (parseError) {
                if (line.trim()) {
                  console.warn(
                    'Failed to parse WAL entry, skipping:',
                    line.substring(0, 50)
                  );
                  debug('WAL parse error: %O', parseError);
                }
                return null;
              }
            })
            .filter((entry): entry is WALEntry => entry !== null);

          entries.push(...batchEntries);
        }
      }

      const duration = performance.now() - startTime;
      debug(
        'WAL replay completed in %dms with %d entries',
        duration,
        entries.length
      );

      // Adjust warning threshold based on number of entries
      // More lenient for large WALs: 4ms per entry for 50+, max 200ms
      const expectedTime =
        entries.length > 50
          ? Math.min(200, 4 * entries.length)
          : Math.min(100, 2 * entries.length);

      if (duration > expectedTime) {
        console.warn(
          `WAL replay took ${duration}ms for ${entries.length} entries`
        );
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
