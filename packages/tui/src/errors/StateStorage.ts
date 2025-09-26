export interface StateSnapshot {
  state: unknown;
  timestamp: Date;
  version?: string;
}

export interface PreservedState {
  current: StateSnapshot;
  previous?: StateSnapshot;
  history: StateSnapshot[];
}

export interface StatePreservationConfig {
  maxHistorySize?: number;
  autoSave?: boolean;
  saveInterval?: number;
  compressionEnabled?: boolean;
  maxStorageSize?: number;
  compressionThreshold?: number;
  enableCompression?: boolean;
  defaultTTL?: number;
  persistPath?: string;
  storageBackend?: string;
}

export interface PreservationOptions {
  compress?: boolean;
  encrypt?: boolean;
  metadata?: Record<string, unknown>;
}

export class StateStorageManager {
  private storage: Map<string, PreservedState> = new Map();
  private maxHistorySize = 10;

  constructor(config?: StatePreservationConfig) {
    if (config?.maxHistorySize !== undefined && config.maxHistorySize > 0) {
      this.maxHistorySize = config.maxHistorySize;
    }
  }

  save(key: string, state: unknown): void {
    const snapshot: StateSnapshot = {
      state,
      timestamp: new Date(),
    };

    const existing = this.storage.get(key);
    if (existing) {
      existing.previous = existing.current;
      existing.current = snapshot;
      existing.history.push(snapshot);

      // Trim history if it exceeds max size
      if (existing.history.length > this.maxHistorySize) {
        existing.history = existing.history.slice(-this.maxHistorySize);
      }
    } else {
      this.storage.set(key, {
        current: snapshot,
        history: [snapshot],
      });
    }
  }

  load(key: string): PreservedState | undefined {
    return this.storage.get(key);
  }

  delete(key: string): void {
    this.storage.delete(key);
  }

  clear(): void {
    this.storage.clear();
  }

  getAllKeys(): string[] {
    return Array.from(this.storage.keys());
  }
}
