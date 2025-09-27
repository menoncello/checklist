import * as fs from 'fs/promises';
import * as path from 'path';
import type { StateStorageManager } from './StateStorage';

export interface DiskManagerConfig {
  persistPath?: string;
  storageBackend: 'memory' | 'disk';
}

export class StatePreservationDiskManager {
  private basePath: string;
  private config: DiskManagerConfig;

  constructor(
    config: DiskManagerConfig,
    private onPersisted: (data: unknown) => void,
    private onError: (data: unknown) => void
  ) {
    this.config = config;
    this.basePath = config.persistPath ?? './.state';
  }

  async persistToDisk(storageManager: StateStorageManager): Promise<void> {
    if (this.config.storageBackend !== 'disk') return;

    try {
      await fs.mkdir(this.basePath, { recursive: true });

      // Save states
      const statesFilePath = path.join(this.basePath, 'states.json');
      const states = storageManager.getValidKeys().map((key) => ({
        key,
        state: storageManager.getState(key),
      }));
      await fs.writeFile(statesFilePath, JSON.stringify(states, null, 2));

      // Save snapshots
      const snapshotsFilePath = path.join(this.basePath, 'snapshots.json');
      const snapshots = storageManager.getSnapshotKeys().map((key) => ({
        key,
        snapshot: storageManager.getSnapshot(key),
      }));
      await fs.writeFile(snapshotsFilePath, JSON.stringify(snapshots, null, 2));

      this.onPersisted({ message: 'Successfully persisted to disk' });
    } catch (error) {
      this.onError({
        error: (error as Error).message || 'Unknown error',
        message: 'Failed to persist to disk',
      });
    }
  }

  updateConfig(config: Partial<DiskManagerConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.persistPath != null) {
      this.basePath = config.persistPath;
    }
  }

  async save(id: string, data: string): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
    const filePath = path.join(this.basePath, `${id}.json`);
    await fs.writeFile(filePath, data);
  }

  async load(id: string): Promise<string | null> {
    try {
      const filePath = path.join(this.basePath, `${id}.json`);
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const filePath = path.join(this.basePath, `${id}.json`);
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.basePath);
      return files
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''));
    } catch {
      return [];
    }
  }
}
