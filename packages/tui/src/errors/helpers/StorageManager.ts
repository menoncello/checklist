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
    const { toDelete, freedSize } = this.identifyStatesToDelete(
      states,
      estimateSize
    );
    this.deleteStates(states, toDelete);
    this.currentStorageSize -= freedSize;
    return { cleaned: toDelete.length, freed: freedSize };
  }

  private identifyStatesToDelete(
    states: Map<string, PreservedState>,
    estimateSize: (state: PreservedState) => number
  ): { toDelete: string[]; freedSize: number } {
    const now = Date.now();
    const toDelete: string[] = [];
    let freedSize = 0;

    freedSize += this.removeExpiredStates(states, now, toDelete, estimateSize);
    freedSize += this.removeOldestStatesIfNeeded(
      states,
      toDelete,
      freedSize,
      estimateSize
    );

    return { toDelete, freedSize };
  }

  private removeExpiredStates(
    states: Map<string, PreservedState>,
    now: number,
    toDelete: string[],
    estimateSize: (state: PreservedState) => number
  ): number {
    let freedSize = 0;
    for (const [key, state] of states.entries()) {
      if (state.expiresAt != null && now > state.expiresAt) {
        toDelete.push(key);
        freedSize += estimateSize(state);
        this.onStateExpired?.(key, state);
      }
    }
    return freedSize;
  }

  private removeOldestStatesIfNeeded(
    states: Map<string, PreservedState>,
    toDelete: string[],
    currentFreedSize: number,
    estimateSize: (state: PreservedState) => number
  ): number {
    if (this.currentStorageSize - currentFreedSize <= this.maxStorageSize) {
      return 0;
    }

    const sortedStates = this.getSortedNonDeletedStates(states, toDelete);
    let additionalFreed = 0;

    for (const [key, state] of sortedStates) {
      if (
        this.currentStorageSize - currentFreedSize - additionalFreed <=
        this.maxStorageSize
      ) {
        break;
      }
      toDelete.push(key);
      additionalFreed += estimateSize(state);
    }

    return additionalFreed;
  }

  private getSortedNonDeletedStates(
    states: Map<string, PreservedState>,
    toDelete: string[]
  ): Array<[string, PreservedState]> {
    return Array.from(states.entries())
      .filter(([key]) => !toDelete.includes(key))
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);
  }

  private deleteStates(
    states: Map<string, PreservedState>,
    toDelete: string[]
  ): void {
    for (const key of toDelete) {
      states.delete(key);
    }
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
      return this.createEmptyMetrics();
    }

    return this.calculateMetrics(stateArray);
  }

  private createEmptyMetrics(): StatePreservationMetrics {
    return {
      totalStates: 0,
      totalSize: 0,
      oldestState: 0,
      newestState: 0,
      expiredStates: 0,
      compressionRatio: 1,
    };
  }

  private calculateMetrics(
    stateArray: PreservedState[]
  ): StatePreservationMetrics {
    const now = Date.now();
    const timestamps = stateArray.map((s) => s.timestamp);
    const expiredCount = this.countExpiredStates(stateArray, now);
    const compressionRatio = this.calculateCompressionRatio(stateArray);

    return {
      totalStates: stateArray.length,
      totalSize: this.currentStorageSize,
      oldestState: Math.min(...timestamps),
      newestState: Math.max(...timestamps),
      expiredStates: expiredCount,
      compressionRatio,
    };
  }

  private countExpiredStates(
    stateArray: PreservedState[],
    now: number
  ): number {
    return stateArray.filter((s) => s.expiresAt != null && now > s.expiresAt)
      .length;
  }

  private calculateCompressionRatio(stateArray: PreservedState[]): number {
    const compressedStates = stateArray.filter(
      (s) => typeof s.data === 'string' && s.data.startsWith('COMPRESSED:')
    ).length;

    return stateArray.length > 0
      ? 1 - (compressedStates / stateArray.length) * 0.3
      : 1;
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
