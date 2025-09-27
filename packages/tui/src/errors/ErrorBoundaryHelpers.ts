export interface ErrorInfo {
  componentStack?: string;
  errorBoundary?: string;
  eventType?: string;
  [key: string]: unknown;
}

export interface ErrorState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
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
  currentRetryCount?: number;
  maxRetries?: number;
}

export interface ErrorUpdateParams extends ErrorStateParams {
  retryCount?: number;
}
export interface ErrorRecordParams extends ErrorStateParams {
  componentStack?: string;
}

export interface ErrorBoundaryConfig {
  maxRetries: number;
  retryDelay: number;
  logErrors: boolean;
  fallbackRenderer?: (
    error: Error,
    errorInfo: Record<string, unknown>
  ) => string;
  enableStatePreservation?: boolean;
  preserveStateOnError?: boolean;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onRetry?: (attempt: number, maxRetries: number) => void;
  onRecovery?: () => void;
}

export interface ErrorBoundaryMetrics {
  totalErrors: number;
  retryAttempts: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  averageRetryTime: number;
  currentRetryCount?: number;
  hasActiveError?: boolean;
  errorFrequency?: number;
  maxRetries?: number;
}

export interface ErrorHistoryEntry {
  error: Error;
  errorInfo: ErrorInfo;
  timestamp: number;
  errorId: string;
  recovered: boolean;
}

export class ErrorStateManager {
  private state: ErrorState;

  constructor(maxRetries = 3) {
    this.state = this.createInitialState(maxRetries);
  }

  private createInitialState(maxRetries: number): ErrorState {
    return {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      timestamp: 0,
      retryCount: 0,
      maxRetries,
    };
  }

  static createErrorState(params: ErrorStateParams): ErrorState {
    return {
      hasError: true,
      error: params.error,
      errorInfo: params.errorInfo,
      errorId: params.errorId,
      timestamp: params.timestamp,
      retryCount: params.currentRetryCount ?? 0,
      maxRetries: params.maxRetries ?? 3,
    };
  }

  static createInitialState(): ErrorState {
    return {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      timestamp: 0,
      retryCount: 0,
      maxRetries: 3,
    };
  }

  static shouldRetry(state: ErrorState): boolean {
    return state.retryCount < state.maxRetries;
  }

  getState(): ErrorState {
    return { ...this.state };
  }

  updateState(params: ErrorStateParams): void {
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
    this.state = this.createInitialState(maxRetries);
    return hadError;
  }

  clearState(maxRetries: number): void {
    this.reset(maxRetries);
  }

  setMaxRetries(maxRetries: number): void {
    this.state.maxRetries = maxRetries;
  }

  getError(): Error | null {
    return this.state.error;
  }

  getErrorInfo(): ErrorInfo | null {
    return this.state.errorInfo;
  }

  resetRetryCount(): void {
    this.state.retryCount = 0;
  }

  incrementRetryCount(): void {
    this.state.retryCount++;
  }

  getRetryCount(): number {
    return this.state.retryCount;
  }
}

export class ErrorHistoryManager {
  private history: ErrorHistoryEntry[] = [];

  addEntry(entry: ErrorHistoryEntry): void {
    this.history.push(entry);
  }

  getHistory(): ErrorHistoryEntry[] {
    return [...this.history];
  }

  getRecentErrors(limit: number): ErrorHistoryEntry[] {
    return this.history.slice(-limit);
  }

  getErrorFrequency(): number {
    const oneHourAgo = Date.now() - 3600000;
    return this.history.filter((e) => e.timestamp > oneHourAgo).length;
  }

  clear(): void {
    this.history = [];
  }
}

export class StatePreservationManager {
  private preservedState = new Map<string, unknown>();
  private currentSnapshot: unknown = null;

  preserveState(key: string, value: unknown): void {
    this.preservedState.set(key, value);
  }

  getPreservedState<T>(key: string): T | null {
    return (this.preservedState.get(key) as T) ?? null;
  }

  clearPreservedState(key?: string): void {
    if (key != null) {
      this.preservedState.delete(key);
    } else {
      this.preservedState.clear();
    }
  }

  preserveSnapshot(state: unknown): void {
    this.currentSnapshot = state;
  }

  restoreSnapshot(): unknown {
    return this.currentSnapshot;
  }

  clear(): void {
    this.preservedState.clear();
    this.currentSnapshot = null;
  }

  // Additional methods for compatibility
  preserve(state: unknown): void {
    this.preserveSnapshot(state);
  }

  restore(): unknown {
    return this.restoreSnapshot();
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

  static processError(error: Error): ErrorInfo {
    return {
      componentStack: error.stack,
      errorBoundary: 'ErrorBoundary',
    };
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
  private checkpoints = new Map<string, RecoveryParams>();

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

  createCheckpoint(_state: ErrorState): string {
    const checkpointId = `checkpoint-${Date.now()}`;
    // Store minimal checkpoint data
    return checkpointId;
  }

  restoreCheckpoint(checkpointId: string): RecoveryParams | null {
    return this.checkpoints.get(checkpointId) ?? null;
  }
}
