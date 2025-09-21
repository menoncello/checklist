import { StatePreservationCompressionManager } from './StatePreservationCompressionManager';
import { StatePreservationDiskManager } from './StatePreservationDiskManager';
import { StatePreservationEventManager } from './StatePreservationEventManager';
import { StatePreservationProcessor } from './StatePreservationProcessor';
import { StatePreservationTimerManager } from './StatePreservationTimerManager';
import { SerializerManager, StateSerializer } from './StateSerializer';
import {
  StateStorageManager,
  PreservedState,
  StateSnapshot,
  StatePreservationConfig,
  PreservationOptions,
} from './StateStorage';

// Re-export types from helper classes
export {
  PreservedState,
  StateSnapshot,
  StatePreservationConfig,
  PreservationOptions,
  StateSerializer,
};

export class StatePreservation {
  private config: StatePreservationConfig;
  private eventManager: StatePreservationEventManager;
  private timerManager: StatePreservationTimerManager;
  private compressionManager: StatePreservationCompressionManager;
  private processor: StatePreservationProcessor;
  private diskManager: StatePreservationDiskManager;
  private serializerManager = new SerializerManager();
  private storageManager = new StateStorageManager();

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
      enableEncryption: false,
      storageBackend: 'memory',
      ...config,
    };
  }

  private initializeManagers(): void {
    this.eventManager = new StatePreservationEventManager();
    this.timerManager = new StatePreservationTimerManager();
    this.compressionManager = new StatePreservationCompressionManager(
      this.config.compressionThreshold,
      this.config.enableCompression
    );
  }

  private initializeProcessors(): void {
    this.processor = new StatePreservationProcessor(
      this.serializerManager,
      this.compressionManager,
      this.config.defaultTTL
    );
    this.diskManager = new StatePreservationDiskManager(
      {
        persistPath: this.config.persistPath,
        storageBackend: this.config.storageBackend,
      },
      (data) => this.eventManager.emit('persistedToDisk', data),
      (data) => this.eventManager.emit('persistError', data)
    );
    this.serializerManager.setupDefaultSerializers();
  }

  private setupTimers(): void {
    this.startCleanupTimer();
    if (this.config.storageBackend === 'disk') {
      this.startPersistTimer();
    }
  }

  public preserve(
    key: string,
    data: unknown,
    options: PreservationOptions = {}
  ): string {
    try {
      const preserved = this.processor.createPreservedState(key, data, options);
      const estimatedSize = this.storageManager.estimateSize(preserved);

      this.checkStorageLimits(estimatedSize);
      this.storageManager.preserveState(key, preserved, estimatedSize);

      this.eventManager.emit('statePreserved', {
        key,
        id: preserved.id,
        size: estimatedSize,
      });
      return preserved.id;
    } catch (error) {
      this.eventManager.emit('preservationError', { key, error });
      throw new Error(
        `Failed to preserve state for key '${key}': ${(error as Error).message}`
      );
    }
  }

  private checkStorageLimits(estimatedSize: number): void {
    if (
      this.storageManager.getCurrentStorageSize() + estimatedSize >
      this.config.maxStorageSize
    ) {
      this.performCleanup();
    }
  }

  public restore<T = unknown>(key: string): T | null {
    const preserved = this.storageManager.getState(key);
    if (!preserved) return null;

    if (this.processor.isExpired(preserved)) {
      this.storageManager.deleteState(key);
      this.eventManager.emit('stateExpired', { key });
      return null;
    }

    try {
      const data = this.processor.restoreStateData(preserved);
      this.eventManager.emit('stateRestored', { key, id: preserved.id });
      return data as T;
    } catch (error) {
      this.eventManager.emit('restorationError', { key, error });
      throw new Error(
        `Failed to restore state for key '${key}': ${(error as Error).message}`
      );
    }
  }

  public createSnapshot(name: string, keys?: string[]): string {
    const snapshot = this.storageManager.createSnapshot(name, keys);

    this.eventManager.emit('snapshotCreated', {
      name,
      id: snapshot.id,
      stateCount: snapshot.states.size,
      totalSize: snapshot.totalSize,
    });

    return snapshot.id;
  }

  public restoreFromSnapshot(name: string, selective?: string[]): boolean {
    const snapshot = this.storageManager.getSnapshot(name);
    if (!snapshot) return false;

    try {
      const restoredCount = this.storageManager.restoreFromSnapshot(
        snapshot,
        selective
      );
      this.eventManager.emit('snapshotRestored', { name, restoredCount });
      return true;
    } catch (error) {
      this.eventManager.emit('snapshotRestorationError', { name, error });
      return false;
    }
  }

  private performCleanup(): void {
    const { cleanedCount, cleanedSize } = this.storageManager.performCleanup(
      this.config
    );

    if (cleanedCount > 0) {
      this.eventManager.emit('cleanupPerformed', { cleanedCount, cleanedSize });
    }
  }

  private startCleanupTimer(): void {
    this.timerManager.startCleanupTimer(() => {
      this.performCleanup();
    }, 60000); // Every minute
  }

  private startPersistTimer(): void {
    this.timerManager.startPersistTimer(() => {
      this.persistToDisk();
    }, 300000); // Every 5 minutes
  }

  private async persistToDisk(): Promise<void> {
    await this.diskManager.persistToDisk(this.storageManager);
  }

  public addSerializer(serializer: StateSerializer): void {
    this.serializerManager.addSerializer(serializer);
  }

  public removeSerializer(type: string): boolean {
    return this.serializerManager.removeSerializer(type);
  }

  public exists(key: string): boolean {
    const state = this.storageManager.getState(key);
    if (!state) return false;

    if (this.processor.isExpired(state)) {
      this.storageManager.deleteState(key);
      return false;
    }

    return true;
  }

  public delete(key: string): boolean {
    const deleted = this.storageManager.deleteState(key);
    if (deleted) {
      this.eventManager.emit('stateDeleted', { key });
    }
    return deleted;
  }

  public clear(): void {
    const count = this.storageManager.getStatesSize();
    this.storageManager.clear();
    this.eventManager.emit('cleared', { count });
  }

  public getKeys(): string[] {
    return this.storageManager.getValidKeys();
  }

  public getSnapshots(): string[] {
    return this.storageManager.getSnapshotKeys();
  }

  public getMetrics(): StatePreservationMetrics {
    return {
      totalStates: this.storageManager.getStatesSize(),
      totalSnapshots: this.storageManager.getSnapshotsSize(),
      currentStorageSize: this.storageManager.getCurrentStorageSize(),
      maxStorageSize: this.config.maxStorageSize,
      utilizationPercent:
        (this.storageManager.getCurrentStorageSize() /
          this.config.maxStorageSize) *
        100,
      expiredStates: 0,
      serializerCount: this.serializerManager.size(),
      compressionEnabled: this.config.enableCompression,
      storageBackend: this.config.storageBackend,
    };
  }

  public updateConfig(newConfig: Partial<StatePreservationConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update processors with new config
    if (newConfig.defaultTTL) {
      this.processor.updateDefaultTTL(newConfig.defaultTTL);
    }

    // Update disk manager config
    this.diskManager.updateConfig({
      persistPath: this.config.persistPath,
      storageBackend: this.config.storageBackend,
    });

    // Restart timers if needed
    if (
      newConfig.storageBackend === 'disk' &&
      !this.timerManager.hasPersistTimer()
    ) {
      this.startPersistTimer();
    } else if (
      newConfig.storageBackend === 'memory' &&
      this.timerManager.hasPersistTimer()
    ) {
      this.timerManager.stopPersistTimer();
    }
  }

  public getConfig(): StatePreservationConfig {
    return { ...this.config };
  }

  public destroy(): void {
    this.timerManager.destroy();
    this.storageManager.clear();
    this.serializerManager.clear();
    this.eventManager.clear();
  }

  public on(event: string, handler: Function): void {
    this.eventManager.on(event, handler);
  }

  public off(event: string, handler: Function): void {
    this.eventManager.off(event, handler);
  }
}

export interface StatePreservationMetrics {
  totalStates: number;
  totalSnapshots: number;
  currentStorageSize: number;
  maxStorageSize: number;
  utilizationPercent: number;
  expiredStates: number;
  serializerCount: number;
  compressionEnabled: boolean;
  storageBackend: string;
}
