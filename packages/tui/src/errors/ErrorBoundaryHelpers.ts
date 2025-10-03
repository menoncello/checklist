export type ErrorInfo = {
  componentStack?: string;
  errorBoundary?: string;
  eventType?: string;
  [key: string]: unknown;
};

export type ErrorState = {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo;
  errorId: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
};

export type ErrorStateParams = {
  error: Error;
  errorInfo: ErrorInfo;
  errorId: string;
  timestamp: number;
  currentRetryCount: number;
  maxRetries: number;
};

export class ErrorStateManager {
  private state: ErrorState = ErrorStateManager.createInitialState();

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

  // Instance methods needed by ErrorBoundary
  recordError(params: ErrorRecordParams): void {
    this.state = {
      ...this.state,
      hasError: true,
      error: params.error,
      errorInfo: params.errorInfo,
      timestamp: Date.now(),
    };
  }

  updateErrorState(params: ErrorUpdateParams): void {
    this.state = {
      ...this.state,
      ...params,
    };
  }

  getState(): ErrorState {
    return { ...this.state };
  }

  resetState(): void {
    this.state = ErrorStateManager.createInitialState();
  }

  // Additional methods needed by ErrorBoundaryCore
  setMaxRetries(maxRetries: number): void {
    this.state = { ...this.state, maxRetries };
  }

  resetRetryCount(): void {
    this.state = { ...this.state, retryCount: 0 };
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

export type RecoveryParams = {
  error: Error;
  errorInfo: ErrorInfo;
  retryCount: number;
  maxRetries: number;
  scheduleRetryCallback: () => void;
  emitCallback: (
    event: string,
    data: { error: Error; errorInfo: ErrorInfo }
  ) => void;
};

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

export type ErrorBoundaryConfig = {
  enableErrorLogging?: boolean;
  enableStatePreservation?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  preserveStateOnError?: boolean;
  fallbackRenderer?: unknown;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  logErrors?: boolean;
};

export type ErrorBoundaryMetrics = {
  totalErrors: number;
  recoveries: number;
  failures: number;
};

export type ErrorHistoryEntry = {
  error: Error;
  errorInfo: ErrorInfo;
  timestamp: Date;
  recovered: boolean;
};

export class ErrorHistoryManager {
  private history: ErrorHistoryEntry[] = [];

  addEntry(entry: ErrorHistoryEntry): void {
    this.history.push(entry);
  }

  getHistory(): ErrorHistoryEntry[] {
    return [...this.history];
  }

  clear(): void {
    this.history = [];
  }

  // Additional methods needed by ErrorBoundaryCore
  getRecentErrors(count: number = 5): ErrorHistoryEntry[] {
    return this.history.slice(-count);
  }

  getErrorFrequency(): number {
    // Simple implementation - errors per hour
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentErrors = this.history.filter(
      (entry) => entry.timestamp.getTime() > oneHourAgo
    );
    return recentErrors.length;
  }
}

export type ErrorRecordParams = {
  error: Error;
  errorInfo: ErrorInfo;
  componentStack?: string;
};

export type ErrorUpdateParams = {
  hasError?: boolean;
  error?: Error | null;
  errorInfo?: ErrorInfo;
  errorId?: string;
  retryCount?: number;
};

export class StatePreservationManager {
  private state: unknown = null;

  preserve(state: unknown): void {
    this.state = state;
  }

  restore(): unknown {
    return this.state;
  }

  clear(): void {
    this.state = null;
  }

  // Additional methods needed by ErrorBoundaryCore
  preserveState(state: unknown): void {
    this.preserve(state);
  }

  getPreservedState(): unknown {
    return this.restore();
  }

  clearPreservedState(): void {
    this.clear();
  }
}
