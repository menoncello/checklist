export type StateEventType =
  | 'save'
  | 'load'
  | 'restore'
  | 'clear'
  | 'error'
  | 'statePreserved'
  | 'stateRestored'
  | 'stateExpired'
  | 'stateDeleted'
  | 'preservationError'
  | 'restorationError'
  | 'snapshotCreated'
  | 'snapshotRestored'
  | 'snapshotRestorationError'
  | 'snapshotDeleted'
  | 'cleanupPerformed'
  | 'persistedToDisk'
  | 'persistError'
  | 'cleared';

export interface StateEvent {
  type: StateEventType;
  timestamp: number;
  data?: unknown;
}

export class StatePreservationEventManager {
  private handlers: Map<string, Set<Function>> = new Map();

  on(type: string, handler: Function): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    const eventHandlers = this.handlers.get(type);
    if (eventHandlers) {
      eventHandlers.add(handler);
    }
  }

  off(type: string, handler: Function): void {
    const eventHandlers = this.handlers.get(type);
    if (eventHandlers) {
      eventHandlers.delete(handler);
    }
  }

  emit(type: string, data?: unknown): void {
    const eventHandlers = this.handlers.get(type);
    if (eventHandlers) {
      eventHandlers.forEach((handler) => {
        try {
          // Pass only the data to the handler, not the full event object
          handler(data);
        } catch (_error) {
          // Silently handle errors in event handlers to prevent cascade failures
          // Could optionally log this error
        }
      });
    }
  }

  clear(): void {
    this.handlers.clear();
  }

  removeAllListeners(): void {
    this.clear();
  }
}
