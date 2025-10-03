/* eslint-disable @typescript-eslint/no-explicit-any */
// Temporary any usage is justified for bridging ErrorState interface incompatibilities
// This will be resolved in future refactoring when ErrorState types are unified

import type { ErrorBoundaryCheckpointManager } from '../ErrorBoundaryCheckpointManager';
import type { ErrorBoundaryEventManager } from '../ErrorBoundaryEventManager';
import {
  ErrorStateManager,
  type ErrorUpdateParams,
  type ErrorState,
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
      this.stateHandler.getState() as any
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
      };

      this.stateManager.resetState();
      if (checkpoint.state.hasError === true) {
        // Create error state using the static method
        const errorState = ErrorStateManager.createErrorState({
          error: params.error ?? new Error('Unknown error'),
          errorInfo: params.errorInfo ?? {},
          errorId: params.errorId ?? 'unknown',
          timestamp: Date.now(),
          currentRetryCount: 0,
          maxRetries: 3,
        });
        // Manually set the state (this is a workaround since setError doesn't exist)
        // Use type assertion to access private state property
        (this.stateManager as unknown as { state: ErrorState }).state =
          errorState;
      }

      this.eventManager.emit('checkpointRestored', { checkpointId });
      return true;
    }

    return false;
  }
}
