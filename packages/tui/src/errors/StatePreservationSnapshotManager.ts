import type { StatePreservationEventManager } from './StatePreservationEventManager';
import type { StatePreservationRecovery } from './StatePreservationRecovery';
import type { StateStorageManager, StateSnapshot } from './StateStorage';

/**
 * Snapshot and recovery operations for StatePreservation
 * Extracted to comply with max-lines ESLint rule
 */
export class StatePreservationSnapshotManager {
  constructor(
    private eventManager: StatePreservationEventManager,
    private storageManager: StateStorageManager,
    private recovery: StatePreservationRecovery
  ) {}

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

  public getSnapshot(name: string): StateSnapshot | null {
    return this.storageManager.getSnapshot(name);
  }

  public listSnapshots(): string[] {
    return this.storageManager.getSnapshotKeys();
  }

  public restoreFromSnapshot(
    snapshot: StateSnapshot,
    selective?: string[]
  ): number {
    const restoredCount = this.storageManager.restoreFromSnapshot(
      snapshot,
      selective
    );
    this.eventManager.emit('snapshotRestored', {
      name: snapshot.name,
      restoredCount,
    });
    return restoredCount;
  }

  public deleteSnapshot(name: string): boolean {
    const result = this.storageManager.deleteSnapshot(name);
    if (result) {
      this.eventManager.emit('snapshotDeleted', { name });
    }
    return result;
  }

  // Recovery checkpoint methods
  public createRecoveryCheckpoint(checkpointId: string, state: unknown): void {
    this.recovery.createRecoveryCheckpoint(checkpointId, state);
  }

  public hasRecoveryCheckpoint(checkpointId: string): boolean {
    return this.recovery.hasRecoveryCheckpoint(checkpointId);
  }

  public listRecoveryCheckpoints(): string[] {
    return this.recovery.listRecoveryCheckpoints();
  }

  public clearRecoveryCheckpoint(): void {
    this.recovery.clearRecoveryCheckpoint();
  }
}
