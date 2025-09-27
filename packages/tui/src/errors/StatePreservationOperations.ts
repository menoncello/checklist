import type { StatePreservationDiskManager } from './StatePreservationDiskManager';
import type { StatePreservationEventManager } from './StatePreservationEventManager';
import type { StatePreservationTimerManager } from './StatePreservationTimerManager';
import type { StateStorageManager } from './StateStorage';

/**
 * Internal operations for StatePreservation
 * Extracted to comply with max-lines ESLint rule
 */
export class StatePreservationOperations {
  constructor(
    private eventManager: StatePreservationEventManager,
    private timerManager: StatePreservationTimerManager,
    private diskManager: StatePreservationDiskManager,
    private storageManager: StateStorageManager
  ) {}

  public startCleanupTimer(
    performCleanup: () => void,
    interval: number = 60000
  ): void {
    this.timerManager.startCleanupTimer(() => {
      performCleanup();
    }, interval);
  }

  public startPersistTimer(
    persistToDisk: () => void,
    interval: number = 60000
  ): void {
    this.timerManager.startPersistTimer(() => {
      persistToDisk();
    }, interval);
  }

  public persistToDisk(): void {
    try {
      const states = this.storageManager.getAllStates();
      this.diskManager.persistToDisk(this.storageManager);
      this.eventManager.emit('persistedToDisk', { count: states.length });
    } catch (error) {
      this.eventManager.emit('persistError', { error });
    }
  }
}
