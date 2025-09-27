import { StatePreservationCompressionManager } from './StatePreservationCompressionManager';
import { StatePreservationDiskManager } from './StatePreservationDiskManager';
import { StatePreservationEventManager } from './StatePreservationEventManager';
import { StatePreservationOperations } from './StatePreservationOperations';
import { StatePreservationProcessor } from './StatePreservationProcessor';
import { StatePreservationRecovery } from './StatePreservationRecovery';
import { StatePreservationSnapshotManager } from './StatePreservationSnapshotManager';
import { StatePreservationTimerManager } from './StatePreservationTimerManager';
import { SerializerManager } from './StateSerializer';
import type { StatePreservationConfig } from './StateStorage';
import { StateStorageManager } from './StateStorage';

/**
 * Initialization helper for StatePreservation
 * Extracted to comply with max-lines ESLint rule
 */
export interface InitializationContext {
  config: StatePreservationConfig;
  eventManager: StatePreservationEventManager;
  timerManager: StatePreservationTimerManager;
  compressionManager: StatePreservationCompressionManager;
  serializerManager: SerializerManager;
  storageManager: StateStorageManager;
  preserve: (key: string, data: unknown) => string;
  exists: (key: string) => boolean;
  getKeys: () => string[];
  deleteState: (key: string) => boolean;
}

export class StatePreservationInitializer {
  static initializeProcessors(context: InitializationContext) {
    const processor = this.createProcessor(context);
    const diskManager = this.createDiskManager(context);
    const recovery = this.createRecovery(context);
    const operations = this.createOperations(context, diskManager);
    const snapshotManager = this.createSnapshotManager(context, recovery);

    context.serializerManager.setupDefaultSerializers();

    return { processor, diskManager, recovery, operations, snapshotManager };
  }

  private static createProcessor(context: InitializationContext) {
    return new StatePreservationProcessor(
      context.serializerManager,
      context.compressionManager,
      context.config.defaultTTL
    );
  }

  private static createDiskManager(context: InitializationContext) {
    return new StatePreservationDiskManager(
      {
        persistPath: context.config.persistPath,
        storageBackend: context.config.storageBackend,
      },
      (_data: unknown) =>
        context.eventManager.emit('statePersisted', { count: 1 }),
      (data: unknown) => context.eventManager.emit('persistenceError', data)
    );
  }

  private static createRecovery(context: InitializationContext) {
    return new StatePreservationRecovery(
      context.preserve,
      context.exists,
      context.getKeys,
      context.deleteState
    );
  }

  private static createOperations(
    context: InitializationContext,
    diskManager: StatePreservationDiskManager
  ) {
    return new StatePreservationOperations(
      context.eventManager,
      context.timerManager,
      diskManager,
      context.storageManager
    );
  }

  private static createSnapshotManager(
    context: InitializationContext,
    recovery: StatePreservationRecovery
  ) {
    return new StatePreservationSnapshotManager(
      context.eventManager,
      context.storageManager,
      recovery
    );
  }
}
