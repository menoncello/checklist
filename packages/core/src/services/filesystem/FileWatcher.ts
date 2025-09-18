/**
 * File watching operations
 * Handles file system monitoring and change notifications
 */

import { watch as fsWatch, FSWatcher } from 'fs';
import type {
  WatchOptions,
  FileChangeHandler,
} from '../../interfaces/IFileSystemService';
import type { Logger } from '../../utils/logger';

export class FileWatcher {
  constructor(private logger: Logger) {}

  watchFile(
    filePath: string,
    handler: FileChangeHandler,
    options?: WatchOptions
  ): () => void {
    const watcher = this.createFileWatcher(filePath, handler, options);
    this.logWatcherCreated(filePath);
    return this.createWatcherCleanupFunction(watcher, filePath);
  }

  private createFileWatcher(
    filePath: string,
    handler: FileChangeHandler,
    options?: WatchOptions
  ): FSWatcher {
    const watcher = fsWatch(
      filePath,
      { persistent: options?.persistent ?? true },
      (eventType, filename) => {
        handler(eventType as 'rename' | 'change', filename ?? filePath);
      }
    );

    watcher.on('error', (error) => {
      this.logWatcherError(filePath, error);
    });

    return watcher;
  }

  private logWatcherCreated(filePath: string): void {
    this.logger.debug({
      msg: 'File watcher created',
      filePath,
    });
  }

  private createWatcherCleanupFunction(
    watcher: FSWatcher,
    filePath: string
  ): () => void {
    return () => {
      watcher.close();
      this.logger.debug({ msg: 'File watcher closed', filePath });
    };
  }

  private logWatcherError(filePath: string, error: unknown): void {
    this.logger.error({
      msg: 'File watcher error',
      filePath,
      error,
    });
  }
}
