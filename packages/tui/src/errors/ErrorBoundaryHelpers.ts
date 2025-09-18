export interface ErrorInfo {
  componentStack?: string;
  errorBoundary?: string;
  eventType?: string;
  [key: string]: unknown;
}

export interface ErrorState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo;
  errorId: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface ErrorStateParams {
  error: Error;
  errorInfo: ErrorInfo;
  errorId: string;
  timestamp: number;
  currentRetryCount: number;
  maxRetries: number;
}

export class ErrorStateManager {
  static createErrorState(params: ErrorStateParams): ErrorState {
    return {
      hasError: true,
      error: params.error,
      errorInfo: params.errorInfo,
      errorId: params.errorId,
      timestamp: params.timestamp,
      retryCount: params.currentRetryCount,
      maxRetries: params.maxRetries,
    };
  }

  static createInitialState(): ErrorState {
    return {
      hasError: false,
      error: null,
      errorInfo: {},
      errorId: '',
      timestamp: 0,
      retryCount: 0,
      maxRetries: 3,
    };
  }

  static shouldRetry(state: ErrorState): boolean {
    return state.retryCount < state.maxRetries;
  }
}

export class ErrorProcessor {
  static processErrorHandling(
    error: Error,
    errorInfo: ErrorInfo,
    config: { logErrors?: boolean; enableStatePreservation?: boolean },
    preserveStateCallback: () => void
  ): void {
    if (config.logErrors === true) {
      this.logError(error, errorInfo);
    }

    if (config.enableStatePreservation === true) {
      preserveStateCallback();
    }
  }

  static executeErrorCallback(
    error: Error,
    errorInfo: ErrorInfo,
    callback?: (error: Error, errorInfo: ErrorInfo) => void
  ): void {
    if (callback) {
      try {
        callback(error, errorInfo);
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError);
      }
    }
  }

  private static logError(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error caught by ErrorBoundary:', {
      error: error.message,
      stack: error.stack,
      errorInfo,
    });
  }
}

export interface RecoveryParams {
  error: Error;
  errorInfo: ErrorInfo;
  retryCount: number;
  maxRetries: number;
  scheduleRetryCallback: () => void;
  emitCallback: (
    event: string,
    data: { error: Error; errorInfo: ErrorInfo }
  ) => void;
}

export class ErrorRecovery {
  static attemptRecovery(params: RecoveryParams): void {
    if (params.retryCount < params.maxRetries) {
      params.scheduleRetryCallback();
    } else {
      params.emitCallback('errorBoundaryExhausted', {
        error: params.error,
        errorInfo: params.errorInfo,
      });
    }
  }
}
