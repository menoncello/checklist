import type { ErrorBoundaryState } from './ErrorBoundaryState';

export interface RecoveryCheckpoint {
  id: string;
  state: ErrorBoundaryState;
  timestamp: number;
}

export class CheckpointManager {
  private checkpoints = new Map<string, RecoveryCheckpoint>();

  createRecoveryCheckpoint(
    checkpointId: string,
    state: ErrorBoundaryState
  ): void {
    this.checkpoints.set(checkpointId, {
      id: checkpointId,
      state: { ...state },
      timestamp: Date.now(),
    });
  }

  hasRecoveryCheckpoint(checkpointId: string): boolean {
    return this.checkpoints.has(checkpointId);
  }

  getRecoveryCheckpoint(checkpointId: string): RecoveryCheckpoint | null {
    return this.checkpoints.get(checkpointId) ?? null;
  }

  listRecoveryCheckpoints(): string[] {
    return Array.from(this.checkpoints.keys());
  }

  clearRecoveryCheckpoint(): void {
    this.checkpoints.clear();
  }

  deleteRecoveryCheckpoint(checkpointId: string): boolean {
    return this.checkpoints.delete(checkpointId);
  }

  // Cleanup old checkpoints (older than 1 hour)
  cleanupOldCheckpoints(): number {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    let deletedCount = 0;

    for (const [id, checkpoint] of this.checkpoints.entries()) {
      if (checkpoint.timestamp < oneHourAgo) {
        this.checkpoints.delete(id);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  getCheckpointCount(): number {
    return this.checkpoints.size;
  }
}
