import { PreservedState } from './SnapshotManager';

export class StatePreservationMetrics {
  totalStates!: number;
  totalSize!: number;
  oldestState!: number;
  newestState!: number;
  expiredStates!: number;
  compressionRatio!: number;
}

export class StorageManager {
  private currentStorageSize = 0;
  private cleanupTimer: Timer | null = null;
  private persistTimer: Timer | null = null;

  constructor(
    private maxStorageSize: number,
    private persistPath?: string,
    private onStateExpired?: (key: string, state: PreservedState) => void
  ) {}

  public trackStorageSize(size: number): void {
    this.currentStorageSize = size;
  }

  public getCurrentSize(): number {
    return this.currentStorageSize;
  }

  public recalculateStorageSize(
    states: Map<string, PreservedState>,
    estimateSize: (state: PreservedState) => number
  ): void {
    this.currentStorageSize = Array.from(states.values()).reduce(
      (total, state) => total + estimateSize(state),
      0
    );
  }

  public performCleanup(
    states: Map<string, PreservedState>,
    estimateSize: (state: PreservedState) => number
  ): { cleaned: number; freed: number } {
    const now = Date.now();
    const toDelete: string[] = [];
    let freedSize = 0;

    // First pass: Remove expired states
    for (const [key, state] of states.entries()) {
      if (state.expiresAt != null && now > state.expiresAt) {
        toDelete.push(key);
        freedSize += estimateSize(state);
        this.onStateExpired?.(key, state);
      }
    }

    // Second pass: If still over limit, remove oldest states
    if (this.currentStorageSize - freedSize > this.maxStorageSize) {
      const sortedStates = Array.from(states.entries())
        .filter(([key]) => !toDelete.includes(key))
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);

      for (const [key, state] of sortedStates) {
        if (this.currentStorageSize - freedSize <= this.maxStorageSize) {
          break;
        }

        toDelete.push(key);
        freedSize += estimateSize(state);
      }
    }

    // Actually delete the states
    for (const key of toDelete) {
      states.delete(key);
    }

    this.currentStorageSize -= freedSize;

    return {
      cleaned: toDelete.length,
      freed: freedSize,
    };
  }

  public startCleanupTimer(
    intervalMs: number,
    cleanupCallback: () => void
  ): void {
    if (this.cleanupTimer != null) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(cleanupCallback, intervalMs);
  }

  public startPersistTimer(
    intervalMs: number,
    persistCallback: () => Promise<void>
  ): void {
    if (this.persistTimer != null) {
      clearInterval(this.persistTimer);
    }

    this.persistTimer = setInterval(() => {
      persistCallback().catch((error) => {
        console.error('Failed to persist state:', error);
      });
    }, intervalMs);
  }

  public async persistToDisk(
    states: Map<string, PreservedState>
  ): Promise<void> {
    if (this.persistPath == null) {
      return;
    }

    const data = {
      timestamp: Date.now(),
      states: Object.fromEntries(states.entries()),
      totalSize: this.currentStorageSize,
    };

    try {
      // In a real implementation, use fs.writeFile or similar
      // For now, we'll simulate the operation
      const serialized = JSON.stringify(data);

      // Simulate async file operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      console.log(
        `Persisted ${states.size} states to ${this.persistPath} (${serialized.length} bytes)`
      );
    } catch (error) {
      throw new Error(
        `Failed to persist to disk: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  public async loadFromDisk(): Promise<Map<string, PreservedState> | null> {
    if (this.persistPath == null) {
      return null;
    }

    try {
      // In a real implementation, use fs.readFile or similar
      // For now, we'll simulate the operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Simulate no persisted data for now
      return new Map<string, PreservedState>();
    } catch (error) {
      console.warn(
        `Failed to load from disk: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return null;
    }
  }

  public getMetrics(
    states: Map<string, PreservedState>
  ): StatePreservationMetrics {
    const stateArray = Array.from(states.values());

    if (stateArray.length === 0) {
      return {
        totalStates: 0,
        totalSize: 0,
        oldestState: 0,
        newestState: 0,
        expiredStates: 0,
        compressionRatio: 1,
      };
    }

    const now = Date.now();
    const timestamps = stateArray.map((s) => s.timestamp);
    const expiredCount = stateArray.filter(
      (s) => s.expiresAt != null && now > s.expiresAt
    ).length;

    // Calculate compression ratio (simplified)
    const compressedStates = stateArray.filter(
      (s) => typeof s.data === 'string' && s.data.startsWith('COMPRESSED:')
    ).length;
    const compressionRatio =
      stateArray.length > 0
        ? 1 - (compressedStates / stateArray.length) * 0.3 // Assume 30% compression
        : 1;

    return {
      totalStates: stateArray.length,
      totalSize: this.currentStorageSize,
      oldestState: Math.min(...timestamps),
      newestState: Math.max(...timestamps),
      expiredStates: expiredCount,
      compressionRatio,
    };
  }

  public updateConfig(maxStorageSize: number, persistPath?: string): void {
    this.maxStorageSize = maxStorageSize;
    this.persistPath = persistPath;
  }

  public destroy(): void {
    if (this.cleanupTimer != null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.persistTimer != null) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }
  }

  public isOverLimit(): boolean {
    return this.currentStorageSize > this.maxStorageSize;
  }

  public getUsagePercentage(): number {
    return (this.currentStorageSize / this.maxStorageSize) * 100;
  }
}
