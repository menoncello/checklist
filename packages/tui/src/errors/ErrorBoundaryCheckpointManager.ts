export interface Checkpoint {
  id: string;
  state: unknown;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export class ErrorBoundaryCheckpointManager {
  private checkpoints: Map<string, Checkpoint> = new Map();
  private maxCheckpoints = 10;

  createCheckpoint(
    id: string,
    state: unknown,
    metadata?: Record<string, unknown>
  ): void {
    const checkpoint: Checkpoint = {
      id,
      state,
      timestamp: new Date(),
      metadata,
    };

    this.checkpoints.set(id, checkpoint);

    // Remove oldest checkpoints if we exceed the limit
    if (this.checkpoints.size > this.maxCheckpoints) {
      const oldestKey = Array.from(this.checkpoints.keys())[0];
      this.checkpoints.delete(oldestKey);
    }
  }

  getCheckpoint(id: string): Checkpoint | undefined {
    return this.checkpoints.get(id);
  }

  getLatestCheckpoint(): Checkpoint | undefined {
    const entries = Array.from(this.checkpoints.values());
    if (entries.length === 0) return undefined;

    return entries.reduce((latest, current) =>
      current.timestamp > latest.timestamp ? current : latest
    );
  }

  clearCheckpoints(): void {
    this.checkpoints.clear();
  }

  getAllCheckpoints(): Checkpoint[] {
    return Array.from(this.checkpoints.values());
  }

  // Additional methods needed by ErrorBoundaryCore
  restoreFromCheckpoint(id: string): unknown {
    const checkpoint = this.getCheckpoint(id);
    return checkpoint?.state;
  }
}
