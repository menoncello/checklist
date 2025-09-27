import type { ErrorBoundaryCheckpointManager } from '../ErrorBoundaryCheckpointManager';
import type { ErrorBoundaryEventManager } from '../ErrorBoundaryEventManager';
import type {
  ErrorStateManager,
  ErrorUpdateParams,
} from '../ErrorBoundaryHelpers';
import type { ErrorBoundaryStateHandler } from '../ErrorBoundaryStateHandler';

export class ErrorBoundaryCheckpointAPI {
  constructor(
    private checkpointManager: ErrorBoundaryCheckpointManager,
    private stateManager: ErrorStateManager,
    private stateHandler: ErrorBoundaryStateHandler,
    private eventManager: ErrorBoundaryEventManager
  ) {}

  createCheckpoint(): string {
    return this.checkpointManager.createCheckpoint(
      this.stateHandler.getState()
    );
  }

  restoreFromCheckpoint(checkpointId: string): boolean {
    const checkpoint =
      this.checkpointManager.restoreFromCheckpoint(checkpointId);

    if (checkpoint != null) {
      const params: ErrorUpdateParams = {
        error: checkpoint.state.error ?? new Error('Unknown error'),
        errorInfo: checkpoint.state.errorInfo ?? {},
        errorId: checkpoint.state.errorId,
        timestamp: checkpoint.state.timestamp,
      };

      this.stateManager.reset(checkpoint.state.maxRetries);
      if (checkpoint.state.hasError === true) {
        this.stateManager.updateState(params);
      }

      this.eventManager.emit('checkpointRestored', { checkpointId });
      return true;
    }

    return false;
  }
}
