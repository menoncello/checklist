import type { StatePreservationEventManager } from './StatePreservationEventManager';
import type { StatePreservationMetrics } from './StatePreservationTypes';
import type { StatePreservationConfig } from './StateStorage';
import type { StateStorageManager } from './StateStorage';

/**
 * Public API methods for StatePreservation
 * Extracted to comply with max-lines ESLint rule
 */
export class StatePreservationPublicAPI {
  constructor(
    private config: StatePreservationConfig,
    private eventManager: StatePreservationEventManager,
    private storageManager: StateStorageManager
  ) {}

  public getKeys(): string[] {
    return this.storageManager.getValidKeys();
  }

  public delete(key: string): boolean {
    const result = this.storageManager.deleteState(key);
    if (result) {
      this.eventManager.emit('stateDeleted', { key });
    }
    return result;
  }

  public emit(event: string, data?: unknown): void {
    this.eventManager.emit(event, data);
  }

  public exists(key: string): boolean {
    return this.storageManager.getState(key) !== null;
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
      expiredStates: 0, // Will be calculated by cleanup
      serializerCount: 1, // Default JSON serializer
      compressionEnabled: this.config.enableCompression,
      storageBackend: this.config.storageBackend,
      totalSize: this.storageManager.getCurrentStorageSize(),
    };
  }

  public clear(): void {
    this.storageManager.clear();
    this.eventManager.emit('allStatesCleared', {});
  }

  public getConfig(): StatePreservationConfig {
    return { ...this.config };
  }

  public performCleanup(config: StatePreservationConfig): void {
    const result = this.storageManager.performCleanup(config);

    // Emit expired events for each expired state
    if (result.expiredKeys) {
      result.expiredKeys.forEach((key) => {
        this.eventManager.emit('stateExpired', { key });
      });
    }

    // Only emit cleanupPerformed if something was actually cleaned
    if (result.cleanedCount > 0) {
      this.eventManager.emit('cleanupPerformed', {
        cleanedCount: result.cleanedCount,
        cleanedSize: result.cleanedSize,
      });

      // Also emit cleanupCompleted for backward compatibility
      this.eventManager.emit('cleanupCompleted', {
        cleanedCount: result.cleanedCount,
        cleanedSize: result.cleanedSize,
      });
    }
  }

  public on(event: string, handler: Function): void {
    this.eventManager.on(event, handler);
  }

  public updateConfig(
    currentConfig: StatePreservationConfig,
    newConfig: Partial<StatePreservationConfig>
  ): StatePreservationConfig {
    const updatedConfig = { ...currentConfig, ...newConfig };
    this.eventManager.emit('configurationUpdated', updatedConfig);
    return updatedConfig;
  }
}
