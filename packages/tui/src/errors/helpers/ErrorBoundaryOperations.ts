import type { ErrorBoundaryConfig } from '../ErrorBoundaryHelpers';

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: Record<string, unknown> | null;
  retryCount: number;
  errorId: string;
  timestamp: number;
  maxRetries: number;
}

export class ErrorBoundaryOperations {
  constructor(private config: ErrorBoundaryConfig) {}

  // Basic error operations - simplified since we don't have access to preservation manager
  canRetry(state: ErrorBoundaryState): boolean {
    return state.retryCount < state.maxRetries;
  }

  createErrorState(
    error: Error,
    errorInfo: Record<string, unknown>
  ): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo,
      retryCount: 0,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      maxRetries: this.config.maxRetries,
    };
  }

  resetErrorState(): ErrorBoundaryState {
    return {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      errorId: '',
      timestamp: 0,
      maxRetries: this.config.maxRetries,
    };
  }

  incrementRetryCount(state: ErrorBoundaryState): ErrorBoundaryState {
    return {
      ...state,
      retryCount: state.retryCount + 1,
    };
  }

  shouldLogError(): boolean {
    return this.config.logErrors === true;
  }

  getMaxRetries(): number {
    return this.config.maxRetries;
  }

  getRetryDelay(): number {
    return this.config.retryDelay;
  }
}
