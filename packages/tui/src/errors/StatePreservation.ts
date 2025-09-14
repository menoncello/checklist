import { DataProcessor } from './helpers/DataProcessor.js';
import { SnapshotManager, PreservedState, StateSnapshot } from './helpers/SnapshotManager.js';
import { StateSerializerManager, StateSerializer } from './helpers/StateSerializerManager.js';
import { StorageManager, StatePreservationMetrics } from './helpers/StorageManager.js';

export { PreservedState, StateSnapshot, StateSerializer, StatePreservationMetrics };

export interface StatePreservationConfig {
  maxStorageSize: number;
  compressionThreshold: number;
  defaultTTL: number;
  enableCompression: boolean;
  enableEncryption: boolean;
  storageBackend: 'memory' | 'disk';
  persistPath?: string;
}

export class StatePreservation {
  private config: StatePreservationConfig;
  private states = new Map<string, PreservedState>();
  private eventHandlers = new Map<string, Set<Function>>();

  private dataProcessor: DataProcessor;
  private serializerManager: StateSerializerManager;
  private snapshotManager: SnapshotManager;
  private storageManager: StorageManager;

  constructor(config: Partial<StatePreservationConfig> = {}) {
    this.config = {
      maxStorageSize: 50 * 1024 * 1024, // 50MB
      compressionThreshold: 1024, // 1KB
      defaultTTL: 3600000, // 1 hour
      enableCompression: true,
      enableEncryption: false,
      storageBackend: 'memory',
      ...config,
    };

    this.dataProcessor = new DataProcessor(
      this.config.enableCompression,
      this.config.compressionThreshold
    );

    this.serializerManager = new StateSerializerManager();
    this.snapshotManager = new SnapshotManager();
    this.storageManager = new StorageManager(
      this.config.maxStorageSize,
      this.config.persistPath,
      (key, state) => this.emit('stateExpired', { key, state })
    );

    this.storageManager.startCleanupTimer(60000, () => this.performCleanup()); // Every minute

    if (this.config.storageBackend === 'disk') {
      this.storageManager.startPersistTimer(300000, () => this.persistToDisk()); // Every 5 minutes
    }
  }

  public preserve(
    key: string,
    data: unknown,
    options: {
      ttl?: number;
      source?: string;
      version?: string;
    } = {}
  ): void {
    try {
      const preserved = this.createPreservedState(data, options);
      this.storePreservedState(key, preserved);
    } catch (error) {
      this.emit('preservationError', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public restore<T = unknown>(key: string): T | null {
    const preserved = this.states.get(key);
    if (preserved == null) {
      return null;
    }

    // Check expiration
    if (preserved.expiresAt != null && Date.now() > preserved.expiresAt) {
      this.delete(key);
      return null;
    }

    try {
      const processed = this.dataProcessor.deprocessData(preserved.data as string);
      const restored = this.serializerManager.deserializeData(processed);

      this.emit('stateRestored', { key, state: preserved });
      return restored as T;
    } catch (error) {
      this.emit('restorationError', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public createSnapshot(name: string, keys?: string[]): string {
    return this.snapshotManager.createSnapshot(
      name,
      this.states,
      keys,
      (state) => this.dataProcessor.estimateSize(JSON.stringify(state))
    );
  }

  public restoreFromSnapshot(name: string, selective?: string[]): boolean {
    const restored = this.snapshotManager.restoreFromSnapshot(name, this.states, selective);
    if (restored) {
      this.updateStorageSize();
      this.emit('snapshotRestored', { name, selective });
    }
    return restored;
  }

  private createPreservedState(
    data: unknown,
    options: { ttl?: number; source?: string; version?: string }
  ): PreservedState {
    const serialized = this.serializerManager.serializeData(data);
    const processed = this.dataProcessor.processData(serialized);
    const checksum = this.dataProcessor.calculateChecksum(processed);

    const expiresAt = options.ttl != null
      ? Date.now() + options.ttl
      : Date.now() + this.config.defaultTTL;

    return {
      id: `preserved-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      data: processed,
      metadata: {
        source: options.source ?? 'unknown',
        version: options.version ?? '1.0.0',
        checksum,
      },
      expiresAt,
    };
  }

  private storePreservedState(key: string, preserved: PreservedState): void {
    this.states.set(key, preserved);
    this.updateStorageSize();
    this.emit('statePreserved', { key, state: preserved });

    if (this.storageManager.isOverLimit()) {
      this.performCleanup();
    }
  }

  private updateStorageSize(): void {
    this.storageManager.recalculateStorageSize(
      this.states,
      (state) => this.dataProcessor.estimateSize(JSON.stringify(state))
    );
  }

  private performCleanup(): void {
    const result = this.storageManager.performCleanup(
      this.states,
      (state) => this.dataProcessor.estimateSize(JSON.stringify(state))
    );

    if (result.cleaned > 0) {
      this.emit('cleanupPerformed', result);
    }
  }

  private async persistToDisk(): Promise<void> {
    try {
      await this.storageManager.persistToDisk(this.states);
      this.emit('statePersisted', { count: this.states.size });
    } catch (error) {
      this.emit('persistenceError', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  public addSerializer(serializer: StateSerializer): void {
    this.serializerManager.addSerializer(serializer);
  }

  public removeSerializer(type: string): boolean {
    return this.serializerManager.removeSerializer(type);
  }

  public exists(key: string): boolean {
    const state = this.states.get(key);
    if (state == null) return false;

    if (state.expiresAt != null && Date.now() > state.expiresAt) {
      this.delete(key);
      return false;
    }

    return true;
  }

  public delete(key: string): boolean {
    const deleted = this.states.delete(key);
    if (deleted) {
      this.updateStorageSize();
      this.emit('stateDeleted', { key });
    }
    return deleted;
  }

  public clear(): void {
    this.states.clear();
    this.snapshotManager.clear();
    this.storageManager.trackStorageSize(0);
    this.emit('allStatesCleared');
  }

  public getKeys(): string[] {
    return Array.from(this.states.keys());
  }

  public getSnapshots(): string[] {
    return this.snapshotManager.getSnapshotNames();
  }

  public getMetrics(): StatePreservationMetrics {
    return this.storageManager.getMetrics(this.states);
  }

  public updateConfig(newConfig: Partial<StatePreservationConfig>): void {
    this.config = { ...this.config, ...newConfig };

    this.dataProcessor.updateConfig(
      this.config.enableCompression,
      this.config.compressionThreshold
    );

    this.storageManager.updateConfig(
      this.config.maxStorageSize,
      this.config.persistPath
    );

    this.emit('configUpdated', this.config);
  }

  public getConfig(): StatePreservationConfig {
    return { ...this.config };
  }

  public destroy(): void {
    this.storageManager.destroy();
    this.clear();
    this.eventHandlers.clear();
    this.emit('destroyed');
  }

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(
            `Error in state preservation event handler for '${event}':`,
            error
          );
        }
      });
    }
  }
}