export interface ErrorInfo {
  componentStack?: string;
  errorBoundary?: string;
  errorBoundaryStack?: string;
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

export interface ErrorHistoryEntry {
  error:
    | Error
    | {
        name: string;
        message: string;
        stack?: string;
      };
  errorInfo: ErrorInfo;
  errorId: string;
  timestamp: number;
  retryCount: number;
}

export interface ErrorBoundaryConfig {
  maxRetries: number;
  retryDelay: number;
  logErrors: boolean;
  fallbackRenderer: (error: Error, errorInfo: ErrorInfo) => string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onRetry?: (attempt: number, maxRetries: number) => void;
  onRecovery?: () => void;
  enableStatePreservation: boolean;
}

export class ErrorBoundary {
  private config: ErrorBoundaryConfig;
  private state: ErrorState;
  private eventHandlers = new Map<string, Set<Function>>();
  private preservedState: Map<string, unknown> = new Map();
  private errorHistory: ErrorHistoryEntry[] = [];
  private maxHistorySize = 50;
  private retryTimer: Timer | null = null;

  constructor(config: Partial<ErrorBoundaryConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      logErrors: true,
      fallbackRenderer: this.defaultFallbackRenderer,
      enableStatePreservation: true,
      ...config,
    };

    this.state = this.createInitialState();
  }

  private createInitialState(): ErrorState {
    return {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      timestamp: 0,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
    };
  }

  public wrap<T extends (...args: unknown[]) => unknown>(fn: T): T {
    const boundary = this;

    return ((...args: unknown[]) => {
      try {
        const result = fn(...args);

        // Handle promises
        if (result instanceof Promise) {
          return result.catch((error) => {
            boundary.handleError(error, { componentStack: fn.name });
            throw error;
          });
        }

        return result;
      } catch (error) {
        boundary.handleError(error as Error, { componentStack: fn.name });
        throw error;
      }
    }) as T;
  }

  public async wrapAsync<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T
  ): Promise<T> {
    const boundary = this;

    return (async (...args: unknown[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        boundary.handleError(error as Error, { componentStack: fn.name });
        throw error;
      }
    }) as T;
  }

  public handleError(error: Error, errorInfo: ErrorInfo = {}): void {
    const errorId = this.generateErrorId();
    const timestamp = Date.now();

    // Update state
    this.state = {
      hasError: true,
      error,
      errorInfo,
      errorId,
      timestamp,
      retryCount: this.state.retryCount,
      maxRetries: this.config.maxRetries,
    };

    // Record error in history
    this.recordError(error, errorInfo, errorId, timestamp);

    // Log error if enabled
    if (this.config.logErrors) {
      this.logError(error, errorInfo);
    }

    // Preserve state if enabled
    if (this.config.enableStatePreservation) {
      this.preserveCurrentState();
    }

    // Call error callback
    if (this.config.onError) {
      try {
        this.config.onError(error, errorInfo);
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError);
      }
    }

    // Emit error event
    this.emit('error', { error, errorInfo, errorId, timestamp });

    // Attempt recovery if retries are available
    if (this.state.retryCount < this.config.maxRetries) {
      this.scheduleRetry();
    } else {
      this.emit('errorBoundaryExhausted', { error, errorInfo });
    }
  }

  // Public API methods for compatibility
  public onError(handler: (error: Error, errorInfo: ErrorInfo) => void): void {
    this.on(
      'error',
      ({ error, errorInfo }: { error: Error; errorInfo: ErrorInfo }) =>
        handler(error, errorInfo)
    );
  }

  public runWithBoundary(fn: () => void): void {
    try {
      fn();
    } catch (error) {
      this.handleError(error as Error, { componentStack: 'runWithBoundary' });
    }
  }

  public async runAsyncWithBoundary(fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (error) {
      this.handleError(error as Error, {
        componentStack: 'runAsyncWithBoundary',
      });
    }
  }

  public getFallbackUI(): string {
    if (this.state.hasError && this.state.error) {
      return this.config.fallbackRenderer(
        this.state.error,
        this.state.errorInfo ?? {}
      );
    }
    return '';
  }

  public async retryOperation<T>(
    operation: () => T,
    maxRetries: number,
    delay: number
  ): Promise<T> {
    let attempts = 0;
    while (attempts < maxRetries) {
      try {
        return operation();
      } catch (error) {
        attempts++;
        if (attempts >= maxRetries) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries exceeded');
  }

  public createComponentBoundary(name: string): ErrorBoundary {
    const boundary = new ErrorBoundary({ ...this.config });
    boundary.on(
      'error',
      ({ error, errorInfo }: { error: Error; errorInfo: ErrorInfo }) => {
        this.emit('componentError', { component: name, error, errorInfo });
      }
    );
    return boundary;
  }

  public reset(): void {
    this.state = this.createInitialState();
    this.errorHistory = [];
    this.preservedState.clear();
  }

  private generateErrorId(): string {
    return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private recordError(
    error: Error,
    errorInfo: ErrorInfo,
    errorId: string,
    timestamp: number
  ): void {
    const entry: ErrorHistoryEntry = {
      errorId,
      timestamp,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorInfo,
      retryCount: this.state.retryCount,
    };

    this.errorHistory.push(entry);

    // Trim history if needed
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }

  private logError(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error caught by ErrorBoundary:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      errorInfo,
      timestamp: new Date().toISOString(),
      retryCount: this.state.retryCount,
    });
  }

  private scheduleRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }

    this.retryTimer = setTimeout(() => {
      this.attemptRetry();
    }, this.config.retryDelay);
  }

  private attemptRetry(): void {
    this.state.retryCount++;

    if (this.config.onRetry) {
      try {
        this.config.onRetry(this.state.retryCount, this.config.maxRetries);
      } catch (callbackError) {
        console.error('Error in retry callback:', callbackError);
      }
    }

    this.emit('retry', {
      attempt: this.state.retryCount,
      maxRetries: this.config.maxRetries,
    });

    // Attempt to restore preserved state
    if (this.config.enableStatePreservation) {
      this.restorePreservedState();
    }

    // Clear error state to allow retry
    this.clearError();
  }

  public retry(): boolean {
    if (this.state.retryCount >= this.config.maxRetries) {
      return false;
    }

    this.attemptRetry();
    return true;
  }

  public clearError(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    const hadError = this.state.hasError;
    this.state = this.createInitialState();

    if (hadError) {
      if (this.config.onRecovery) {
        try {
          this.config.onRecovery();
        } catch (callbackError) {
          console.error('Error in recovery callback:', callbackError);
        }
      }

      this.emit('recovery');
    }
  }

  public resetRetryCount(): void {
    this.state.retryCount = 0;
  }

  public render(): string {
    if (!this.state.hasError || !this.state.error) {
      return '';
    }

    try {
      return this.config.fallbackRenderer(
        this.state.error,
        this.state.errorInfo ?? {}
      );
    } catch (fallbackError) {
      console.error('Error in fallback renderer:', fallbackError);
      return this.emergencyFallbackRenderer(this.state.error);
    }
  }

  private defaultFallbackRenderer(error: Error, _errorInfo: ErrorInfo): string {
    const lines = [
      '┌─ Error Boundary ─────────────────────────────┐',
      '│                                              │',
      `│ Error: ${error.name.padEnd(34)} │`,
      `│ ${error.message.substring(0, 42).padEnd(42)} │`,
      '│                                              │',
      '│ This component has encountered an error.     │',
      '│ The application will attempt to recover.     │',
      '│                                              │',
      '└──────────────────────────────────────────────┘',
    ];

    return lines.join('\n');
  }

  private emergencyFallbackRenderer(error: Error): string {
    return [
      'ERROR BOUNDARY FAILURE',
      `Error: ${error.name}`,
      `Message: ${error.message}`,
      'The error boundary itself has failed.',
      'Please check the console for more details.',
    ].join('\n');
  }

  public preserveCurrentState(): void {
    // This method should be called with actual state to preserve
    // For now, we just mark that preservation was attempted
    this.preservedState.set('preservationTimestamp', Date.now());
  }

  public restorePreservedState(): void {
    const timestamp = this.preservedState.get('preservationTimestamp');
    if (timestamp != null) {
      this.emit('stateRestored', { timestamp });
    }
  }

  public preserveState(key: string, value: unknown): void {
    this.preservedState.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  public getPreservedState<T>(key: string): T | null {
    const preserved = this.preservedState.get(key);
    if (
      preserved != null &&
      typeof preserved === 'object' &&
      'value' in preserved
    ) {
      return (preserved as { value: T }).value;
    }
    return null;
  }

  public clearPreservedState(key?: string): void {
    if (key != null && key.length > 0) {
      this.preservedState.delete(key);
    } else {
      this.preservedState.clear();
    }
  }

  public hasError(): boolean {
    return this.state.hasError;
  }

  public getError(): Error | null {
    return this.state.error;
  }

  public getErrorInfo(): ErrorInfo | null {
    return this.state.errorInfo;
  }

  public getErrorState(): ErrorState {
    return { ...this.state };
  }

  public canRetry(): boolean {
    return this.state.retryCount < this.config.maxRetries;
  }

  public getRemainingRetries(): number {
    return Math.max(0, this.config.maxRetries - this.state.retryCount);
  }

  public getErrorHistory(): ErrorHistoryEntry[] {
    return [...this.errorHistory];
  }

  public getRecentErrors(limit: number = 10): ErrorHistoryEntry[] {
    return this.errorHistory.slice(-limit);
  }

  public getErrorFrequency(): number {
    const now = Date.now();
    const recentErrors = this.errorHistory.filter(
      (entry) => now - entry.timestamp < 60000 // Last minute
    );
    return recentErrors.length;
  }

  public updateConfig(newConfig: Partial<ErrorBoundaryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.state.maxRetries = this.config.maxRetries;
  }

  public getConfig(): ErrorBoundaryConfig {
    return { ...this.config };
  }

  public createCheckpoint(): string {
    const checkpointId = `checkpoint-${Date.now()}`;
    this.preserveState(checkpointId, {
      state: { ...this.state },
      timestamp: Date.now(),
    });
    return checkpointId;
  }

  public restoreFromCheckpoint(checkpointId: string): boolean {
    const checkpoint = this.getPreservedState(checkpointId);
    if (
      checkpoint != null &&
      typeof checkpoint === 'object' &&
      checkpoint !== null &&
      'state' in checkpoint &&
      checkpoint.state != null
    ) {
      this.state = { ...(checkpoint as { state: ErrorState }).state };
      this.emit('checkpointRestored', { checkpointId });
      return true;
    }
    return false;
  }

  public getMetrics(): ErrorBoundaryMetrics {
    const now = Date.now();
    const last24Hours = this.errorHistory.filter(
      (entry) => now - entry.timestamp < 86400000
    );

    return {
      totalErrors: this.errorHistory.length,
      errorsLast24Hours: last24Hours.length,
      currentRetryCount: this.state.retryCount,
      maxRetries: this.config.maxRetries,
      hasActiveError: this.state.hasError,
      errorFrequency: this.getErrorFrequency(),
      preservedStateCount: this.preservedState.size,
      lastErrorTimestamp:
        this.errorHistory.length > 0
          ? this.errorHistory[this.errorHistory.length - 1].timestamp
          : null,
    };
  }

  public destroy(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    this.eventHandlers.clear();
    this.preservedState.clear();
    this.errorHistory = [];
    this.state = this.createInitialState();
  }

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(
            `Error in error boundary event handler for '${event}':`,
            error
          );
        }
      });
    }
  }
}

interface ErrorBoundaryMetrics {
  totalErrors: number;
  errorsLast24Hours: number;
  currentRetryCount: number;
  maxRetries: number;
  hasActiveError: boolean;
  errorFrequency: number;
  preservedStateCount: number;
  lastErrorTimestamp: number | null;
}
