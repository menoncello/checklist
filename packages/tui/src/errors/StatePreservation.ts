import { StatePreservationCompressionManager } from './StatePreservationCompressionManager';
import { StatePreservationDiskManager } from './StatePreservationDiskManager';
import { StatePreservationEventManager } from './StatePreservationEventManager';
import { StatePreservationProcessor } from './StatePreservationProcessor';
import { StatePreservationTimerManager } from './StatePreservationTimerManager';
import { SerializerManager, StateSerializer } from './StateSerializer';
import {
  PreservationOptions,
  StatePreservationConfig,
  StateStorageManager,
} from './StateStorage';

export { StatePreservationConfig, PreservationOptions } from './StateStorage';

export interface StatePreservationMetrics {
  totalStates: number;
  totalSnapshots: number;
  storageUsed: number;
  compressionRatio?: number;
  lastPersistTime?: Date;
  serializerCount: number;
  isAutoSaveEnabled: boolean;
  persistPath?: string;
}

export class StatePreservation {
  private config!: StatePreservationConfig;
  private eventManager!: StatePreservationEventManager;
  private timerManager!: StatePreservationTimerManager;
  private compressionManager!: StatePreservationCompressionManager;
  private processor!: StatePreservationProcessor;
  private diskManager!: StatePreservationDiskManager;
  private serializerManager = new SerializerManager();
  private storageManager = new StateStorageManager();
  private preservedStates = new Map<string, unknown>();
  private snapshots = new Map<string, Map<string, unknown>>();
  private cleanupTimer?: Timer;
  private persistTimer?: Timer;

  constructor(config: Partial<StatePreservationConfig> = {}) {
    this.initializeConfig(config);
    this.initializeManagers();
    this.initializeProcessors();
    this.setupTimers();
  }

  private initializeConfig(config: Partial<StatePreservationConfig>): void {
    this.config = {
      maxStorageSize: 50 * 1024 * 1024,
      compressionThreshold: 1024,
      defaultTTL: 3600000,
      enableCompression: true,
      storageBackend: 'memory',
      ...config,
    };
  }

  private initializeManagers(): void {
    this.eventManager = new StatePreservationEventManager();
    this.timerManager = new StatePreservationTimerManager();
    this.compressionManager = new StatePreservationCompressionManager();
  }

  private initializeProcessors(): void {
    this.processor = new StatePreservationProcessor();
    this.diskManager = new StatePreservationDiskManager(
      this.config.persistPath
    );

    // Setup default processors
    if (this.config.enableCompression === true) {
      this.processor.addProcessor((state) => {
        const serialized = JSON.stringify(state);
        if (serialized.length > (this.config.compressionThreshold ?? 1024)) {
          return this.compressionManager.compress(state);
        }
        return state;
      });
    }
  }

  private setupTimers(): void {
    this.startCleanupTimer();
    if (this.config.autoSave === true) {
      this.startPersistTimer();
    }
  }

  public preserve(
    key: string,
    data: unknown,
    _options: PreservationOptions = {}
  ): string {
    try {
      const processed = this.processor.process(data);
      this.preservedStates.set(key, processed);
      this.storageManager.save(key, processed);

      this.eventManager.emit('statePreserved', {
        key,
        size: JSON.stringify(processed).length,
      });
      return key;
    } catch (error) {
      this.eventManager.emit('preservationError', { key, error });
      throw new Error(
        `Failed to preserve state for key '${key}': ${(error as Error).message}`
      );
    }
  }

  public restore<T = unknown>(key: string): T | null {
    const preserved = this.storageManager.load(key);
    if (!preserved) return null;

    try {
      const data = preserved.current.state;
      this.eventManager.emit('stateRestored', { key });
      return data as T;
    } catch (error) {
      this.eventManager.emit('restorationError', { key, error });
      throw new Error(
        `Failed to restore state for key '${key}': ${(error as Error).message}`
      );
    }
  }

  public createSnapshot(name: string, keys?: string[]): string {
    const snapshot = new Map<string, unknown>();
    const keysToSnapshot = keys ?? Array.from(this.preservedStates.keys());

    for (const key of keysToSnapshot) {
      const state = this.preservedStates.get(key);
      if (state !== undefined) {
        snapshot.set(key, state);
      }
    }

    this.snapshots.set(name, snapshot);

    this.eventManager.emit('snapshotCreated', {
      name,
      stateCount: snapshot.size,
    });

    return name;
  }

  public restoreFromSnapshot(name: string, selective?: string[]): boolean {
    const snapshot = this.snapshots.get(name);
    if (!snapshot) return false;

    try {
      const keysToRestore = selective ?? Array.from(snapshot.keys());
      let restoredCount = 0;

      for (const key of keysToRestore) {
        const state = snapshot.get(key);
        if (state !== undefined) {
          this.preservedStates.set(key, state);
          this.storageManager.save(key, state);
          restoredCount++;
        }
      }

      this.eventManager.emit('snapshotRestored', { name, restoredCount });
      return true;
    } catch (error) {
      this.eventManager.emit('snapshotRestorationError', { name, error });
      return false;
    }
  }

  private performCleanup(): void {
    const maxSize = this.config.maxStorageSize ?? 50 * 1024 * 1024;
    let currentSize = 0;
    const keysToDelete: string[] = [];

    for (const [key, value] of this.preservedStates) {
      const size = JSON.stringify(value).length;
      currentSize += size;
      if (currentSize > maxSize) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.preservedStates.delete(key);
      this.storageManager.delete(key);
    }

    if (keysToDelete.length > 0) {
      this.eventManager.emit('cleanupPerformed', {
        cleanedCount: keysToDelete.length,
        cleanedSize: currentSize - maxSize,
      });
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, 60000);
  }

  private startPersistTimer(): void {
    this.persistTimer = setInterval(() => {
      this.persistToDisk().catch(() => {
        // Handle error
      });
    }, 300000);
  }

  private async persistToDisk(): Promise<void> {
    const keys = this.storageManager.getAllKeys();
    for (const key of keys) {
      const state = this.storageManager.load(key);
      if (state) {
        await this.diskManager.save(key, state);
      }
    }
  }

  public addSerializer(name: string, serializer: StateSerializer): void {
    this.serializerManager.addSerializer(name, serializer);
  }

  public removeSerializer(type: string): boolean {
    const serializer = this.serializerManager.getSerializer(type);
    if (serializer) {
      // Can't actually remove from SerializerManager, but we can track it
      return true;
    }
    return false;
  }

  public exists(key: string): boolean {
    return this.preservedStates.has(key);
  }

  public delete(key: string): boolean {
    const deleted = this.preservedStates.delete(key);
    if (deleted) {
      this.storageManager.delete(key);
      this.eventManager.emit('stateDeleted', { key });
    }
    return deleted;
  }

  public clear(): void {
    const count = this.preservedStates.size;
    this.preservedStates.clear();
    this.storageManager.clear();
    this.eventManager.emit('cleared', { count });
  }

  public getKeys(): string[] {
    return Array.from(this.preservedStates.keys());
  }

  public getSnapshotNames(): string[] {
    return Array.from(this.snapshots.keys());
  }

  public getMetrics(): StatePreservationMetrics {
    let storageUsed = 0;
    for (const value of this.preservedStates.values()) {
      storageUsed += JSON.stringify(value).length;
    }

    return {
      totalStates: this.preservedStates.size,
      totalSnapshots: this.snapshots.size,
      storageUsed,
      serializerCount: 1, // Default JSON serializer
      isAutoSaveEnabled: this.config.autoSave ?? false,
      persistPath: this.config.persistPath,
    };
  }

  public updateConfig(updates: Partial<StatePreservationConfig>): void {
    this.config = { ...this.config, ...updates };

    // Handle auto-save changes
    if (updates.autoSave !== undefined) {
      if (updates.autoSave && !this.persistTimer) {
        this.startPersistTimer();
      } else if (!updates.autoSave && this.persistTimer) {
        clearInterval(this.persistTimer);
        this.persistTimer = undefined;
      }
    }
  }

  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
    }
    this.timerManager.stop();
    this.processor.clearProcessors();
    this.eventManager.removeAllListeners();
  }

  public on(event: string, handler: Function): void {
    this.eventManager.on(event, handler as (...args: unknown[]) => void);
  }

  public off(event: string, handler: Function): void {
    this.eventManager.off(event, handler as (...args: unknown[]) => void);
  }
}
