import { existsSync, mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createLogger } from '../utils/logger';

const logger = createLogger('checklist:wal');

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
    logger.debug({ msg: 'WAL initialized', walPath: this.walPath });
  }

  async append(entry: Omit<WALEntry, 'timestamp'>): Promise<void> {
    const startTime = performance.now();

    await this.enforceRateLimit();

    const fullEntry: WALEntry = { ...entry, timestamp: Date.now() };
    this.entries.push(fullEntry);

    try {
      await this.writeEntryToFile(fullEntry);
      this.logAppendPerformance(startTime);
    } catch (error) {
      logger.error({ msg: 'WAL append failed', error });
      throw new Error(`Failed to append to WAL: ${error}`);
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    if (now - this.lastWriteTime > this.rateWindow) {
      this.writeCount = 0;
      this.lastWriteTime = now;
    }

    this.writeCount++;
    if (this.writeCount > this.maxWritesPerWindow) {
      const waitTime = this.rateWindow - (now - this.lastWriteTime);
      logger.debug({ msg: 'Rate limit exceeded, waiting', waitTime });
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.writeCount = 1;
      this.lastWriteTime = Date.now();
    }
  }

  private async writeEntryToFile(entry: WALEntry): Promise<void> {
    const entryLine = JSON.stringify(entry) + '\n';
    const file = Bun.file(this.walPath);

    if (await file.exists()) {
      const currentContent = await file.text();
      await Bun.write(this.walPath, currentContent + entryLine);
    } else {
      await Bun.write(this.walPath, entryLine);
    }
  }

  private logAppendPerformance(startTime: number): void {
    const duration = performance.now() - startTime;
    logger.debug({ msg: 'WAL append completed', duration });

    if (duration > 10) {
      logger.warn({
        msg: 'WAL append performance warning',
        duration,
        target: 10,
      });
    }
  }

  async replay(): Promise<WALEntry[]> {
    if (this.isReplaying) {
      logger.debug({ msg: 'WAL replay already in progress' });
      return this.entries;
    }

    const startTime = performance.now();
    this.isReplaying = true;

    try {
      const walContent = await this.readWALContent();
      if (
        walContent === null ||
        walContent === undefined ||
        walContent === ''
      ) {
        return [];
      }

      const lines = walContent.split('\n').filter(Boolean);
      const entries = await this.parseWALEntries(lines);

      this.logReplayPerformance(startTime, entries.length);
      this.entries = entries;
      return entries;
    } catch (error) {
      logger.error({ msg: 'WAL replay failed', error });
      throw new Error(`Failed to replay WAL: ${error}`);
    } finally {
      this.isReplaying = false;
    }
  }

  async clear(): Promise<void> {
    const startTime = performance.now();

    try {
      this.entries = [];
      await this.removeWALFile();
      this.logClearPerformance(startTime);
    } catch (error) {
      logger.error({ msg: 'WAL clear failed', error });
      throw new Error(`Failed to clear WAL: ${error}`);
    }
  }

  private async removeWALFile(): Promise<void> {
    const file = Bun.file(this.walPath);
    if (await file.exists()) {
      await unlink(this.walPath);
    }
  }

  private logClearPerformance(startTime: number): void {
    const duration = performance.now() - startTime;
    logger.debug({ msg: 'WAL cleared', duration });

    if (duration > 5) {
      logger.warn({
        msg: `WAL clear took ${duration}ms, exceeding 5ms target`,
      });
    }
  }

  private async readWALContent(): Promise<string | null> {
    const file = Bun.file(this.walPath);
    if (!(await file.exists())) {
      logger.debug({ msg: 'No WAL file found for replay' });
      return null;
    }

    const content = await file.text();
    if (!content.trim()) {
      logger.debug({ msg: 'WAL file is empty' });
      return null;
    }

    return content;
  }

  private async parseWALEntries(lines: string[]): Promise<WALEntry[]> {
    const batches = this.createBatches(lines);

    if (lines.length > 50) {
      return this.parseEntriesInParallel(batches);
    }

    return this.parseEntriesSequentially(batches);
  }

  private createBatches(lines: string[]): string[][] {
    const batchSize = lines.length > 50 ? 25 : 10;
    const batches: string[][] = [];

    for (let i = 0; i < lines.length; i += batchSize) {
      batches.push(lines.slice(i, Math.min(i + batchSize, lines.length)));
    }

    return batches;
  }

  private async parseEntriesInParallel(
    batches: string[][]
  ): Promise<WALEntry[]> {
    const parsedBatches = await Promise.all(
      batches.map(async (batch) => this.parseBatch(batch, false))
    );

    const entries: WALEntry[] = [];
    for (const batchEntries of parsedBatches) {
      entries.push(...batchEntries);
    }

    return entries;
  }

  private async parseEntriesSequentially(
    batches: string[][]
  ): Promise<WALEntry[]> {
    const entries: WALEntry[] = [];

    for (const batch of batches) {
      const batchEntries = this.parseBatch(batch, true);
      entries.push(...batchEntries);
    }

    return entries;
  }

  private parseBatch(
    batch: string[],
    includeDetailedErrors: boolean
  ): WALEntry[] {
    return batch
      .map((line) => this.parseLine(line, includeDetailedErrors))
      .filter((entry): entry is WALEntry => entry !== null);
  }

  private parseLine(
    line: string,
    includeDetailedErrors: boolean
  ): WALEntry | null {
    try {
      if (line.trim()) {
        return JSON.parse(line) as WALEntry;
      }
      return null;
    } catch (parseError) {
      if (line.trim()) {
        logger.warn({
          msg: includeDetailedErrors
            ? 'Failed to parse WAL entry, skipping'
            : 'WAL parse error for line',
          line: line.substring(0, 50),
        });

        if (includeDetailedErrors) {
          logger.error({ msg: 'WAL parse error', error: parseError });
        }
      }
      return null;
    }
  }

  private logReplayPerformance(startTime: number, entryCount: number): void {
    const duration = performance.now() - startTime;

    logger.info({
      msg: 'WAL replay completed',
      duration,
      entryCount,
    });

    const expectedTime =
      entryCount > 50
        ? Math.min(200, 4 * entryCount)
        : Math.min(100, 2 * entryCount);

    if (duration > expectedTime) {
      logger.warn({
        msg: `WAL replay took ${duration}ms for ${entryCount} entries`,
      });
    }
  }

  async getEntries(): Promise<WALEntry[]> {
    return [...this.entries];
  }

  // Alias for getEntries to maintain compatibility
  async getWALEntries(): Promise<WALEntry[]> {
    return this.getEntries();
  }

  // Alias for append
  async writeEntry(entry: Omit<WALEntry, 'timestamp'>): Promise<void> {
    return this.append(entry);
  }

  async getSize(): Promise<number> {
    return this.size();
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
    const backupPath = this.generateBackupPath();

    try {
      await this.copyWALToBackup(backupPath);
      return backupPath;
    } catch (error) {
      logger.error({ msg: 'WAL backup failed', error });
      throw new Error(`Failed to create WAL backup: ${error}`);
    }
  }

  private generateBackupPath(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return this.walPath.replace('.log', `-${timestamp}.backup`);
  }

  private async copyWALToBackup(backupPath: string): Promise<void> {
    const file = Bun.file(this.walPath);
    if (await file.exists()) {
      const content = await file.text();
      await Bun.write(backupPath, content);
      logger.debug({ msg: 'WAL backup created', backupPath });
    }
  }

  async applyEntry(
    entry: WALEntry,
    applyFn: (entry: WALEntry) => Promise<void>
  ): Promise<void> {
    try {
      await applyFn(entry);
      logger.debug({ msg: 'Applied WAL entry', entry });
    } catch (error) {
      logger.error({ msg: 'Failed to apply WAL entry', error, entry });
      throw new Error(`Failed to apply WAL entry: ${error}`);
    }
  }

  async rotate(maxSize: number = 10 * 1024 * 1024): Promise<void> {
    const currentSize = await this.size();

    if (this.shouldRotate(currentSize, maxSize)) {
      await this.performRotation(currentSize);
    }
  }

  private shouldRotate(currentSize: number, maxSize: number): boolean {
    return currentSize > maxSize;
  }

  private async performRotation(currentSize: number): Promise<void> {
    await this.createBackup();
    await this.clear();
    logger.debug({ msg: 'WAL rotated', size: currentSize });
  }
}
