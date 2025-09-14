export class PreservedState {
  id!: string;
  timestamp!: number;
  data!: unknown;
  metadata!: {
    source: string;
    version: string;
    checksum: string;
  };
  expiresAt?: number;
}

export class StateSnapshot {
  id!: string;
  timestamp!: number;
  states!: Map<string, PreservedState>;
  totalSize!: number;
  compressed!: boolean;
}

export class SnapshotManager {
  private snapshots = new Map<string, StateSnapshot>();

  public createSnapshot(
    name: string,
    states: Map<string, PreservedState>,
    keys?: string[],
    estimateSize: (state: PreservedState) => number = () => 0
  ): string {
    const snapshotId = `snapshot-${name}-${Date.now()}`;
    const selectedStates = new Map<string, PreservedState>();

    if (keys != null && keys.length > 0) {
      // Include only specified keys
      for (const key of keys) {
        const state = states.get(key);
        if (state != null) {
          selectedStates.set(key, { ...state });
        }
      }
    } else {
      // Include all states
      for (const [key, state] of states.entries()) {
        selectedStates.set(key, { ...state });
      }
    }

    const totalSize = Array.from(selectedStates.values()).reduce(
      (size, state) => size + estimateSize(state),
      0
    );

    const snapshot: StateSnapshot = {
      id: snapshotId,
      timestamp: Date.now(),
      states: selectedStates,
      totalSize,
      compressed: totalSize > 10240, // Compress if larger than 10KB
    };

    this.snapshots.set(name, snapshot);
    return snapshotId;
  }

  public restoreFromSnapshot(
    name: string,
    targetStates: Map<string, PreservedState>,
    selective?: string[]
  ): boolean {
    const snapshot = this.snapshots.get(name);
    if (snapshot == null) {
      return false;
    }

    if (selective != null && selective.length > 0) {
      // Restore only selected keys
      for (const key of selective) {
        const state = snapshot.states.get(key);
        if (state != null) {
          targetStates.set(key, { ...state });
        }
      }
    } else {
      // Restore all states from snapshot
      for (const [key, state] of snapshot.states.entries()) {
        targetStates.set(key, { ...state });
      }
    }

    return true;
  }

  public getSnapshot(name: string): StateSnapshot | null {
    return this.snapshots.get(name) ?? null;
  }

  public deleteSnapshot(name: string): boolean {
    return this.snapshots.delete(name);
  }

  public hasSnapshot(name: string): boolean {
    return this.snapshots.has(name);
  }

  public getSnapshotNames(): string[] {
    return Array.from(this.snapshots.keys());
  }

  public getSnapshotMetrics(): {
    count: number;
    totalStates: number;
    totalSize: number;
    oldestSnapshot: number;
    newestSnapshot: number;
  } {
    const snapshots = Array.from(this.snapshots.values());

    if (snapshots.length === 0) {
      return {
        count: 0,
        totalStates: 0,
        totalSize: 0,
        oldestSnapshot: 0,
        newestSnapshot: 0,
      };
    }

    const totalStates = snapshots.reduce((sum, s) => sum + s.states.size, 0);
    const totalSize = snapshots.reduce((sum, s) => sum + s.totalSize, 0);
    const timestamps = snapshots.map((s) => s.timestamp);

    return {
      count: snapshots.length,
      totalStates,
      totalSize,
      oldestSnapshot: Math.min(...timestamps),
      newestSnapshot: Math.max(...timestamps),
    };
  }

  public clear(): void {
    this.snapshots.clear();
  }

  public pruneOldSnapshots(maxAge: number): number {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [name, snapshot] of this.snapshots.entries()) {
      if (now - snapshot.timestamp > maxAge) {
        toDelete.push(name);
      }
    }

    for (const name of toDelete) {
      this.snapshots.delete(name);
    }

    return toDelete.length;
  }

  public exportSnapshot(name: string): string | null {
    const snapshot = this.snapshots.get(name);
    if (snapshot == null) {
      return null;
    }

    // Convert Map to plain object for JSON serialization
    const exportData = {
      ...snapshot,
      states: Object.fromEntries(snapshot.states.entries()),
    };

    return JSON.stringify(exportData, null, 2);
  }

  public importSnapshot(name: string, data: string): boolean {
    try {
      const importData = JSON.parse(data);
      const snapshot: StateSnapshot = {
        ...importData,
        states: new Map(Object.entries(importData.states)),
      };

      this.snapshots.set(name, snapshot);
      return true;
    } catch (_error) {
      return false;
    }
  }
}
