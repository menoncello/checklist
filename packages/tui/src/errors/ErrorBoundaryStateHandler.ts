import type {
  ErrorState,
  ErrorStateManager,
  ErrorHistoryManager,
  ErrorHistoryEntry,
  StatePreservationManager,
  ErrorUpdateParams,
  ErrorRecordParams,
} from './ErrorBoundaryHelpers';

export class ErrorBoundaryStateHandler {
  constructor(
    private stateManager: ErrorStateManager,
    private historyManager: ErrorHistoryManager,
    private preservationManager: StatePreservationManager,
    private enableStatePreservation?: boolean
  ) {}

  updateErrorState(params: ErrorUpdateParams): void {
    this.stateManager.updateState(params);
  }

  recordError(params: ErrorRecordParams): void {
    const entry: ErrorHistoryEntry = {
      error: params.error,
      errorInfo: params.errorInfo,
      timestamp: params.timestamp,
      errorId: params.errorId,
      recovered: false,
    };
    this.historyManager.addEntry(entry);
  }

  preserveCurrentState(): void {
    if (this.enableStatePreservation === true) {
      const state = this.stateManager.getState();
      this.preservationManager.preserveSnapshot(state);
    }
  }

  restorePreservedState(): unknown {
    if (this.enableStatePreservation === true) {
      return this.preservationManager.restoreSnapshot();
    }
    return null;
  }

  incrementRetryCount(): void {
    this.stateManager.incrementRetryCount();
  }

  getRetryCount(): number {
    return this.stateManager.getRetryCount();
  }

  reset(maxRetries: number): boolean {
    return this.stateManager.reset(maxRetries);
  }

  getState(): ErrorState {
    return this.stateManager.getState();
  }

  hasError(): boolean {
    return this.stateManager.getState().hasError;
  }

  updateStatePreservationConfig(enable?: boolean): void {
    this.enableStatePreservation = enable;
  }

  updateError(params: ErrorUpdateParams): void {
    this.stateManager.updateState(params);
  }
}
