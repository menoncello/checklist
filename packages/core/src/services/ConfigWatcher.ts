import type { IFileSystemService } from '../interfaces/IFileSystemService';
import type { Logger } from '../utils/logger';

/**
 * Configuration file watcher
 */
export class ConfigWatcher {
  private watchers: Set<(content: string) => void> = new Set();
  private watcherCleanup?: () => void;

  constructor(
    private fileSystemService: IFileSystemService,
    private logger: Logger
  ) {}

  /**
   * Setup file watching
   */
  async setupWatch(
    configPath: string,
    onChange: (content: string) => void
  ): Promise<void> {
    try {
      if (!(await this.validateFile(configPath))) {
        return;
      }

      this.watchers.add(onChange);
      await this.startFileMonitoring(configPath);

      this.logger.debug({
        msg: 'File watcher setup',
        path: configPath,
      });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to setup file watcher',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Validate file exists
   */
  private async validateFile(configPath: string): Promise<boolean> {
    const exists = await this.fileSystemService.exists(configPath);
    if (!exists) {
      this.logger.warn({
        msg: 'Cannot watch config file - file does not exist',
        path: configPath,
      });
      return false;
    }
    return true;
  }

  /**
   * Start monitoring file for changes
   */
  private async startFileMonitoring(configPath: string): Promise<void> {
    let lastModified = (await this.fileSystemService.getFileInfo(configPath))
      .modifiedAt;

    const checkFile = setInterval(async () => {
      await this.checkForFileChanges(configPath, lastModified, (newMtime) => {
        lastModified = newMtime;
      });
    }, 1000);

    this.watcherCleanup = () => {
      clearInterval(checkFile);
      this.watchers.clear();
    };
  }

  /**
   * Check if file has changed
   */
  private async checkForFileChanges(
    configPath: string,
    lastModified: Date,
    onUpdate: (mtime: Date) => void
  ): Promise<void> {
    try {
      const fileInfo = await this.fileSystemService.getFileInfo(configPath);
      if (fileInfo.modifiedAt > lastModified) {
        onUpdate(fileInfo.modifiedAt);
        const content = await this.fileSystemService.readFile(configPath);
        this.notifyWatchers(content);
      }
    } catch (error) {
      this.logger.error({
        msg: 'Error checking config file',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Stop watching
   */
  stopWatch(): void {
    if (this.watcherCleanup) {
      this.watcherCleanup();
      this.watcherCleanup = undefined;
    }
  }

  /**
   * Add a watcher callback
   */
  addWatcher(callback: (content: string) => void): void {
    this.watchers.add(callback);
  }

  /**
   * Remove a watcher callback
   */
  removeWatcher(callback: (content: string) => void): void {
    this.watchers.delete(callback);
  }

  /**
   * Notify all watchers
   */
  private notifyWatchers(content: string): void {
    this.watchers.forEach((watcher) => {
      try {
        watcher(content);
      } catch (error) {
        this.logger.error({
          msg: 'Error in config watcher callback',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  /**
   * Check if watching
   */
  isWatching(): boolean {
    return this.watcherCleanup !== undefined;
  }

  /**
   * Get watcher count
   */
  getWatcherCount(): number {
    return this.watchers.size;
  }
}
