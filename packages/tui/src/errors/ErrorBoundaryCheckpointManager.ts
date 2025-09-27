import type { ErrorState } from './ErrorBoundaryHelpers';

export interface RecoveryCheckpoint {
  id: string;
  state: ErrorState;
  timestamp: number;
}

export class ErrorBoundaryCheckpointManager {
  private checkpoints = new Map<string, RecoveryCheckpoint>();

  constructor(private preservationManager: unknown) {}

  createCheckpoint(state: ErrorState): string {
    const checkpointId = `checkpoint-${Date.now()}`;
    this.checkpoints.set(checkpointId, {
      id: checkpointId,
      state: { ...state },
      timestamp: Date.now(),
    });
    return checkpointId;
  }

  restoreFromCheckpoint(checkpointId: string): RecoveryCheckpoint | null {
    return this.checkpoints.get(checkpointId) ?? null;
  }

  hasCheckpoint(checkpointId: string): boolean {
    return this.checkpoints.has(checkpointId);
  }

  clearCheckpoints(): void {
    this.checkpoints.clear();
  }
}
