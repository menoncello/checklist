export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: Record<string, unknown> | null;
  retryCount: number;
  errorId: string;
  timestamp: number;
  maxRetries: number;
}

export interface ErrorUpdateParams {
  error: Error;
  errorInfo: Record<string, unknown>;
  errorId: string;
  timestamp: number;
}

export interface ErrorInfo {
  componentStack?: string;
  errorBoundary?: string;
  errorBoundaryStack?: string;
}

export class ErrorBoundaryStateManager {
  private state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    retryCount: 0,
    errorId: '',
    timestamp: 0,
    maxRetries: 0,
  };

  getState(): ErrorBoundaryState {
    return { ...this.state };
  }

  updateState(params: ErrorUpdateParams): void {
    this.state = {
      hasError: true,
      error: params.error,
      errorInfo: params.errorInfo,
      retryCount: this.state.retryCount,
      errorId: params.errorId,
      timestamp: params.timestamp,
      maxRetries: this.state.maxRetries,
    };
  }

  reset(maxRetries: number): boolean {
    const hadError = this.state.hasError;
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      errorId: '',
      timestamp: 0,
      maxRetries,
    };
    return hadError;
  }

  incrementRetryCount(): void {
    this.state.retryCount++;
  }

  getRetryCount(): number {
    return this.state.retryCount;
  }

  canRetry(maxRetries: number): boolean {
    return this.state.retryCount < maxRetries;
  }

  getErrorFallbackState(): ErrorBoundaryState {
    return {
      hasError: true,
      error: new Error('Unknown error occurred'),
      errorInfo: {},
      retryCount: this.state.retryCount,
      errorId: `fallback-${Date.now()}`,
      timestamp: Date.now(),
      maxRetries: this.state.maxRetries,
    };
  }
}
