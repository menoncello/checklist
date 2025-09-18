import { createLogger } from '../utils/logger';
import { WALFileManager } from './WALFileManager';
import { WALRateLimiter } from './WALRateLimiter';

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
  private entries: WALEntry[] = [];
  private isReplaying = false;
  private fileManager: WALFileManager;
  private rateLimiter: WALRateLimiter;

  constructor(stateDirectory: string) {
    this.fileManager = new WALFileManager(stateDirectory);
    this.rateLimiter = new WALRateLimiter();
  }

  async append(entry: Omit<WALEntry, 'timestamp'>): Promise<void> {
    if (this.isReplaying) {
      return; // Don't write during replay
    }

    if (!this.rateLimiter.canWrite()) {
      throw new Error('WAL write rate limit exceeded');
    }

    const fullEntry: WALEntry = {
      ...entry,
      timestamp: Date.now(),
    };

    this.entries.push(fullEntry);
    await this.persistEntry(fullEntry);
    this.rateLimiter.recordWrite();

    logger.debug({
      msg: 'WAL entry appended',
      op: entry.op,
      key: entry.key,
      timestamp: fullEntry.timestamp,
    });
  }

  private async persistEntry(entry: WALEntry): Promise<void> {
    const file = Bun.file(this.fileManager.getWalPath());
    const data = JSON.stringify(entry) + '\n';

    // Append to file (create if doesn't exist)
    const existingContent = (await file.exists()) ? await file.text() : '';
    await Bun.write(this.fileManager.getWalPath(), existingContent + data);
  }

  async replay(): Promise<WALEntry[]>;
  async replay<T>(
    applyFn: (entry: WALEntry) => Promise<void>,
    getState: () => T
  ): Promise<T>;
  async replay<T>(
    applyFn?: (entry: WALEntry) => Promise<void>,
    getState?: () => T
  ): Promise<T | WALEntry[]> {
    if (applyFn && getState) {
      this.isReplaying = true;
      try {
        await this.loadEntries();
        await this.applyEntries(applyFn);
        return getState();
      } finally {
        this.isReplaying = false;
      }
    } else {
      await this.loadEntries();
      return this.getEntries();
    }
  }

  private async loadEntries(): Promise<void> {
    if (!(await this.fileManager.exists())) {
      logger.debug({ msg: 'No WAL file to replay' });
      return;
    }

    try {
      const content = await this.fileManager.readFile();
      this.entries = this.parseWALContent(content);
      logger.info({ msg: 'WAL entries loaded', count: this.entries.length });
    } catch (error) {
      logger.error({ msg: 'Failed to load WAL', error });
      throw error;
    }
  }

  private parseWALContent(content: string): WALEntry[] {
    const lines = content.split('\n').filter((line) => line.trim());
    const entries: WALEntry[] = [];

    for (const line of lines) {
      try {
        entries.push(JSON.parse(line) as WALEntry);
      } catch (error) {
        logger.warn({ msg: 'Invalid WAL entry', line, error });
      }
    }

    return entries;
  }

  private async applyEntries(
    applyFn: (entry: WALEntry) => Promise<void>
  ): Promise<void> {
    for (const entry of this.entries) {
      try {
        await applyFn(entry);
        logger.debug({ msg: 'WAL entry applied', entry });
      } catch (error) {
        logger.error({ msg: 'Failed to apply WAL entry', entry, error });
      }
    }
  }

  async clear(): Promise<void> {
    this.entries = [];
    await this.fileManager.clearFile();
    this.rateLimiter.reset();
    logger.debug({ msg: 'WAL cleared' });
  }

  getEntries(): WALEntry[] {
    return [...this.entries];
  }

  // Alias methods for compatibility
  async getWALEntries(): Promise<WALEntry[]> {
    return this.getEntries();
  }

  async writeEntry(entry: Omit<WALEntry, 'timestamp'>): Promise<void> {
    return this.append(entry);
  }

  async getSize(): Promise<number> {
    return this.size();
  }

  async exists(): Promise<boolean> {
    return this.fileManager.exists();
  }

  async size(): Promise<number> {
    const stats = await this.fileManager.getFileStats();
    return stats.size;
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
    return this.fileManager
      .getWalPath()
      .replace('.log', `-${timestamp}.backup`);
  }

  private async copyWALToBackup(backupPath: string): Promise<void> {
    if (await this.fileManager.exists()) {
      const content = await this.fileManager.readFile();
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
    } catch (error) {
      logger.error({ msg: 'Failed to apply entry', entry, error });
      throw new Error(`Failed to apply WAL entry: ${error}`);
    }
  }

  async rotate(maxSize?: number): Promise<void> {
    const currentSize = await this.size();

    if (typeof maxSize === 'number' && maxSize > 0 && currentSize <= maxSize) {
      return; // Don't rotate if under size limit
    }

    // Create backup first
    await this.createBackup();

    // Clear the WAL
    await this.clear();
  }
}
