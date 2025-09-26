export interface ErrorState {
  hasError: boolean;
  error?: Error;
  errorInfo?: unknown;
  recovery?: boolean;
  timestamp?: Date;
  errorId?: string;
  retryCount?: number;
  maxRetries?: number;
}

export class ErrorBoundaryStateHandler {
  private state: ErrorState = { hasError: false };
  private previousStates: ErrorState[] = [];
  private maxStateHistory = 10;

  getState(): ErrorState {
    return { ...this.state };
  }

  setState(newState: Partial<ErrorState>): void {
    this.previousStates.push({ ...this.state });

    if (this.previousStates.length > this.maxStateHistory) {
      this.previousStates.shift();
    }

    this.state = {
      ...this.state,
      ...newState,
      timestamp: new Date(),
    };
  }

  setError(error: Error, errorInfo?: unknown): void {
    this.setState({
      hasError: true,
      error,
      errorInfo,
      recovery: false,
    });
  }

  clearError(): void {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      recovery: false,
    });
  }

  setRecovery(): void {
    this.setState({ recovery: true });
  }

  getPreviousStates(): ErrorState[] {
    return [...this.previousStates];
  }

  reset(): void {
    this.state = { hasError: false };
    this.previousStates = [];
  }

  // Additional methods needed by ErrorBoundaryCore
  getRetryCount(): number {
    return this.state.retryCount ?? 0;
  }

  incrementRetryCount(): void {
    this.setState({
      retryCount: (this.state.retryCount ?? 0) + 1,
    });
  }

  recordError(_error: Error, _errorInfo?: unknown): void {
    // Default implementation for recording errors
    this.setError(_error, _errorInfo);
  }

  updateError(_params: unknown): void {
    // Default no-op implementation for updating error state
  }

  updateErrorState(_error: Error, _errorInfo?: unknown): void {
    this.setError(_error, _errorInfo);
  }

  preserveCurrentState(): void {
    // Default implementation - just push current state to history
    this.previousStates.push({ ...this.state });
  }

  restorePreservedState(): void {
    if (this.previousStates.length > 0) {
      const restored = this.previousStates.pop();
      if (restored) {
        this.state = restored;
      }
    }
  }

  hasError(): boolean {
    return this.state.hasError;
  }

  updateStatePreservationConfig(_config: unknown): void {
    // Default no-op implementation
  }
}
