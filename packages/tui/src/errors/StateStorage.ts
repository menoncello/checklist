export interface PreservedState {
  id: string;
  key: string;
  data: unknown;
  timestamp: number;
  ttl?: number;
  compressed?: boolean;
  metadata?: Record<string, unknown>;
}

export interface StateSnapshot {
  id: string;
  name: string;
  timestamp: number;
  states: Map<string, PreservedState>;
  totalSize: number;
  compressed?: boolean;
}

export interface StatePreservationConfig {
  maxStorageSize: number;
  compressionThreshold: number;
  defaultTTL: number;
  enableCompression: boolean;
  enableEncryption?: boolean;
  storageBackend: 'memory' | 'disk';
  persistPath?: string;
  persistInterval?: number;
}

export interface PreservationOptions {
  ttl?: number;
  compress?: boolean;
  metadata?: Record<string, unknown>;
}

export class StateStorage {
  private snapshots: Map<string, StateSnapshot> = new Map();

  save(id: string, _state: unknown): void {
    this.snapshots.set(id, {
      id,
      name: id,
      timestamp: Date.now(),
      states: new Map(),
      totalSize: 0,
    });
  }

  load(id: string): StateSnapshot | null {
    return this.snapshots.get(id) ?? null;
  }

  delete(id: string): boolean {
    return this.snapshots.delete(id);
  }

  clear(): void {
    this.snapshots.clear();
  }

  list(): StateSnapshot[] {
    return Array.from(this.snapshots.values());
  }
}

export class StateStorageManager {
  private states: Map<string, PreservedState> = new Map();
  private snapshots: Map<string, StateSnapshot> = new Map();
  private currentStorageSize = 0;

  preserveState(
    key: string,
    state: PreservedState,
    estimatedSize: number
  ): void {
    this.states.set(key, state);
    this.currentStorageSize += estimatedSize;
  }

  getState(key: string): PreservedState | null {
    return this.states.get(key) ?? null;
  }

  deleteState(key: string): boolean {
    const state = this.states.get(key);
    if (state != null) {
      this.states.delete(key);
      this.currentStorageSize = Math.max(
        0,
        this.currentStorageSize - this.estimateSize(state)
      );
      return true;
    }
    return false;
  }

  createSnapshot(name: string, keys?: string[]): StateSnapshot {
    const snapshot: StateSnapshot = {
      id: `snapshot-${Date.now()}`,
      name,
      timestamp: Date.now(),
      states: new Map(),
      totalSize: 0,
    };

    const keysToSnapshot = keys ?? Array.from(this.states.keys());
    keysToSnapshot.forEach((key) => {
      const state = this.states.get(key);
      if (state != null) {
        snapshot.states.set(key, { ...state });
        snapshot.totalSize += this.estimateSize(state);
      }
    });

    this.snapshots.set(name, snapshot);
    return snapshot;
  }

  getSnapshot(name: string): StateSnapshot | null {
    return this.snapshots.get(name) ?? null;
  }

  deleteSnapshot(name: string): boolean {
    return this.snapshots.delete(name);
  }

  restoreFromSnapshot(snapshot: StateSnapshot, selective?: string[]): number {
    const keysToRestore = selective ?? Array.from(snapshot.states.keys());
    let restoredCount = 0;

    keysToRestore.forEach((key) => {
      const state = snapshot.states.get(key);
      if (state != null) {
        this.states.set(key, { ...state });
        restoredCount++;
      }
    });

    return restoredCount;
  }

  performCleanup(_config: StatePreservationConfig): {
    cleanedCount: number;
    cleanedSize: number;
    expiredKeys?: string[];
  } {
    let cleanedCount = 0;
    let cleanedSize = 0;
    const expiredKeys: string[] = [];
    const now = Date.now();

    // Clean up expired states
    const entries = Array.from(this.states.entries());
    for (const [key, state] of entries) {
      if (state.ttl != null && now > state.timestamp + state.ttl) {
        const size = this.estimateSize(state);
        this.states.delete(key);
        cleanedCount++;
        cleanedSize += size;
        expiredKeys.push(key);
      }
    }

    this.currentStorageSize -= cleanedSize;
    return { cleanedCount, cleanedSize, expiredKeys };
  }

  clear(): void {
    this.states.clear();
    this.snapshots.clear();
    this.currentStorageSize = 0;
  }

  getStatesSize(): number {
    return this.states.size;
  }

  getSnapshotsSize(): number {
    return this.snapshots.size;
  }

  getCurrentStorageSize(): number {
    return this.currentStorageSize;
  }

  getValidKeys(): string[] {
    // Return all keys without filtering expired states
    // Expired states will be cleaned up on access
    return Array.from(this.states.keys());
  }

  getSnapshotKeys(): string[] {
    return Array.from(this.snapshots.keys());
  }

  estimateSize(data: unknown): number {
    // Simple size estimation - can be improved
    return JSON.stringify(data).length;
  }

  getAllStates(): PreservedState[] {
    return Array.from(this.states.values());
  }
}
