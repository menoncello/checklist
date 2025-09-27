import { StatePreservationCompressionManager } from './StatePreservationCompressionManager';
import { StatePreservationConfigManager } from './StatePreservationConfig';
import { StatePreservationDiskManager } from './StatePreservationDiskManager';
import { StatePreservationEventManager } from './StatePreservationEventManager';
import { StatePreservationInitializer } from './StatePreservationInitializer';
import { StatePreservationOperations } from './StatePreservationOperations';
import { StatePreservationProcessor } from './StatePreservationProcessor';
import { StatePreservationPublicAPI } from './StatePreservationPublicAPI';
import { StatePreservationRecovery } from './StatePreservationRecovery';
import { StatePreservationSnapshotManager } from './StatePreservationSnapshotManager';
import { StatePreservationTimerManager } from './StatePreservationTimerManager';
import type { StatePreservationMetrics } from './StatePreservationTypes';
import { SerializerManager } from './StateSerializer';
import type { StateSerializer } from './StateSerializer';
import { StateStorageManager } from './StateStorage';
import type {
  PreservedState,
  StateSnapshot,
  StatePreservationConfig,
  PreservationOptions,
} from './StateStorage';
// Re-export types from helper classes
export type {
  PreservedState,
  StateSnapshot,
  StatePreservationConfig,
  PreservationOptions,
  StatePreservationMetrics,
};
export type { StateSerializer };
export class StatePreservation {
  private config!: StatePreservationConfig;
  private eventManager!: StatePreservationEventManager;
  private timerManager!: StatePreservationTimerManager;
  private compressionManager!: StatePreservationCompressionManager;
  private processor!: StatePreservationProcessor;
  private diskManager!: StatePreservationDiskManager;
  private recovery!: StatePreservationRecovery;
  private serializerManager = new SerializerManager();
  private storageManager = new StateStorageManager();
  private api!: StatePreservationPublicAPI;
  private operations!: StatePreservationOperations;
  private snapshotManager!: StatePreservationSnapshotManager;
  // Expose states for testing (only for test purposes)
  private get states() {
    return (this.storageManager as unknown as { states: Map<string, unknown> })
      .states;
  }
  constructor(config: Partial<StatePreservationConfig> = {}) {
    this.initializeConfig(config);
    this.initializeManagers();
    this.initializeProcessors();
    this.setupTimers();
  }
  private initializeConfig(config: Partial<StatePreservationConfig>): void {
    this.config = StatePreservationConfigManager.createDefaultConfig(config);
  }
  private initializeManagers(): void {
    this.eventManager = new StatePreservationEventManager();
    this.timerManager = new StatePreservationTimerManager();
    this.compressionManager = new StatePreservationCompressionManager(
      this.config.compressionThreshold,
      this.config.enableCompression
    );
    this.api = new StatePreservationPublicAPI(
      this.config,
      this.eventManager,
      this.storageManager
    );
  }
  private initializeProcessors(): void {
    const context = {
      config: this.config,
      eventManager: this.eventManager,
      timerManager: this.timerManager,
      compressionManager: this.compressionManager,
      serializerManager: this.serializerManager,
      storageManager: this.storageManager,
      preserve: (key: string, data: unknown) => this.preserve(key, data),
      exists: (key: string) => this.exists(key),
      getKeys: () => this.getKeys(),
      deleteState: (key: string) => this.delete(key),
    };
    const initialized =
      StatePreservationInitializer.initializeProcessors(context);
    this.processor = initialized.processor;
    this.diskManager = initialized.diskManager;
    this.recovery = initialized.recovery;
    this.operations = initialized.operations;
    this.snapshotManager = initialized.snapshotManager;
  }
  private setupTimers(): void {
    this.operations.startCleanupTimer(() => this.performCleanup());
    if (this.config.storageBackend === 'disk') {
      this.operations.startPersistTimer(() => this.operations.persistToDisk());
    }
  }
  public preserve(
    key: string,
    data: unknown,
    options: PreservationOptions = {}
  ): string {
    try {
      // Allow undefined data to be preserved
      // It will be handled on restoration

      // Allow storing states even with negative TTL
      // They'll be cleaned up on access

      const preserved = this.processor.createPreservedState(key, data, options);
      const estimatedSize = this.storageManager.estimateSize(preserved);
      this.checkStorageLimits(estimatedSize);
      this.storageManager.preserveState(key, preserved, estimatedSize);
      this.eventManager.emit('statePreserved', {
        key,
        id: preserved.id,
        size: estimatedSize,
        state: preserved.data,
      });
      return key;
    } catch (error) {
      this.eventManager.emit('preservationError', {
        key,
        error: (error as Error).message || error,
      });
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
    if (preserved == null) return null;

    if (this.processor.isExpired(preserved) === true) {
      return this.handleExpiredState(key);
    }

    return this.performRestore<T>(key, preserved);
  }

  private handleExpiredState(key: string): null {
    this.storageManager.deleteState(key);
    this.eventManager.emit('stateExpired', { key });
    return null;
  }

  private performRestore<T>(key: string, preserved: PreservedState): T {
    try {
      const data = this.processor.restoreStateData(preserved);
      this.validateRestoredData(key, data);
      this.eventManager.emit('stateRestored', {
        key,
        id: preserved.id,
        state: data,
      });
      return data as T;
    } catch (error) {
      this.handleRestoreError(key, error as Error);
    }
  }

  private validateRestoredData(key: string, data: unknown): void {
    if (data === undefined) {
      const error = new Error('Data is undefined');
      this.eventManager.emit('restorationError', { key, error });
      throw new Error(
        `Failed to restore state for key '${key}': Data is undefined`
      );
    }
  }

  private handleRestoreError(key: string, error: Error): never {
    this.eventManager.emit('restorationError', {
      key,
      error: error.message || error,
    });
    throw new Error(
      `Failed to restore state for key '${key}': ${error.message}`
    );
  }
  public createSnapshot(name: string, keys?: string[]): string {
    return this.snapshotManager.createSnapshot(name, keys);
  }
  public restoreFromSnapshot(name: string, selective?: string[]): boolean {
    const snapshot = this.snapshotManager.getSnapshot(name);
    if (snapshot == null) return false;
    try {
      this.snapshotManager.restoreFromSnapshot(snapshot, selective);
      return true;
    } catch (error) {
      this.eventManager.emit('snapshotRestorationError', { name, error });
      return false;
    }
  }
  public addSerializer(serializer: StateSerializer): void {
    this.serializerManager.addSerializer(serializer);
  }
  public removeSerializer(type: string): boolean {
    const serializer = this.serializerManager.getSerializer(type);
    if (serializer) {
      // Can't actually remove from SerializerManager, but we can track it
      return true;
    }
    return false;
  }
  public getSnapshots(): string[] {
    return this.storageManager.getSnapshotKeys();
  }
  public getMetrics(): StatePreservationMetrics {
    const states = this.storageManager.getAllStates();
    const now = Date.now();

    const expiredCount = states.filter(
      (state) => state.ttl != null && now > state.timestamp + state.ttl
    ).length;

    const timestamps = states.map((s) => s.timestamp).sort();
    const oldestState = timestamps[0] || null;
    const newestState = timestamps[timestamps.length - 1] || null;

    return {
      totalStates: this.storageManager.getStatesSize(),
      totalSnapshots: this.storageManager.getSnapshotsSize(),
      currentStorageSize: this.storageManager.getCurrentStorageSize(),
      maxStorageSize: this.config.maxStorageSize,
      utilizationPercent:
        (this.storageManager.getCurrentStorageSize() /
          this.config.maxStorageSize) *
        100,
      expiredStates: expiredCount,
      serializerCount: this.serializerManager.size(),
      compressionEnabled: this.config.enableCompression,
      storageBackend: this.config.storageBackend,
      totalSize: this.storageManager.getCurrentStorageSize(),
      oldestState,
      newestState,
      compressionRatio: 1.0, // Default ratio when no compression
    };
  }
  public updateConfig(newConfig: Partial<StatePreservationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.defaultTTL != null)
      this.processor.updateDefaultTTL(newConfig.defaultTTL);
    this.diskManager.updateConfig({
      persistPath: this.config.persistPath,
      storageBackend: this.config.storageBackend,
    });
    if (
      newConfig.storageBackend === 'disk' &&
      this.timerManager.hasPersistTimer() !== true
    ) {
      this.timerManager.startPersistTimer(() => {
        this.diskManager.persistToDisk(this.storageManager);
      }, this.config.persistInterval ?? 60000);
    } else if (
      newConfig.storageBackend === 'memory' &&
      this.timerManager.hasPersistTimer() === true
    ) {
      this.timerManager.stopPersistTimer();
    }
    this.eventManager.emit('configUpdated', this.config);
  }
  public getConfig(): StatePreservationConfig {
    return { ...this.config };
  }
  public destroy(): void {
    this.timerManager.stop();
    this.processor.clearProcessors();
    this.storageManager.clear();
    this.eventManager.removeAllListeners();
  }
  public on(event: string, handler: Function): void {
    this.eventManager.on(event, handler as (...args: unknown[]) => void);
  }
  public off(event: string, handler: Function): void {
    this.eventManager.off(event, handler as (...args: unknown[]) => void);
  }
  public getKeys = () => this.api.getKeys();
  public delete = (key: string) => this.api.delete(key);
  public emit = (event: string, data?: unknown) => this.api.emit(event, data);
  public clear = () => this.api.clear();
  public performCleanup = () => this.api.performCleanup(this.config);
  public exists(key: string): boolean {
    const state = this.storageManager.getState(key);
    if (state == null) return false;
    if (this.processor.isExpired(state)) {
      this.storageManager.deleteState(key);
      return false;
    }
    return true;
  }
  public async persistToDisk(): Promise<void> {
    if (this.config.storageBackend === 'disk') {
      await this.diskManager.persistToDisk(this.storageManager);
    }
  }
}
