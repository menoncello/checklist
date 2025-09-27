import type { ErrorInfo } from './ErrorBoundaryState';

export interface ErrorBoundaryConfig {
  maxRetries: number;
  retryDelay: number;
  showDetails: boolean;
  captureErrorInfo: boolean;
}

export class ErrorBoundaryRetryManager {
  private retryTimer: NodeJS.Timeout | null = null;

  scheduleRetry(delay: number, callback: () => void): void {
    if (this.retryTimer != null) {
      clearTimeout(this.retryTimer);
    }
    this.retryTimer = setTimeout(callback, delay);
  }

  cancelScheduledRetry(): void {
    if (this.retryTimer != null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  cleanup(): void {
    this.cancelScheduledRetry();
  }
}

export class ErrorBoundaryOperationsManager {
  private errorCallback: ((error: Error, errorInfo: ErrorInfo) => void) | null =
    null;
  private retryCallback:
    | ((attempt: number, maxRetries: number) => void)
    | null = null;
  private recoveryCallback: (() => void) | null = null;

  setErrorCallback(
    callback: (error: Error, errorInfo: ErrorInfo) => void
  ): void {
    this.errorCallback = callback;
  }

  setRetryCallback(
    callback: (attempt: number, maxRetries: number) => void
  ): void {
    this.retryCallback = callback;
  }

  setRecoveryCallback(callback: () => void): void {
    this.recoveryCallback = callback;
  }

  executeErrorCallback(error: Error, errorInfo: ErrorInfo): void {
    if (this.errorCallback != null) {
      this.errorCallback(error, errorInfo);
    }
  }

  executeRetryCallback(attempt: number, maxRetries: number): void {
    if (this.retryCallback != null) {
      this.retryCallback(attempt, maxRetries);
    }
  }

  executeRecoveryCallback(): void {
    if (this.recoveryCallback != null) {
      this.recoveryCallback();
    }
  }

  canRetry(retryCount: number): boolean {
    return this.retryCallback != null && retryCount >= 0;
  }
}

export class ErrorBoundaryEventManager {
  private eventHandlers = new Map<string, Set<Function>>();

  emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(
            `Error in ErrorBoundary event handler for '${event}':`,
            error
          );
        }
      });
    }
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.add(handler);
    }
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.delete(handler);
    }
  }

  clear(): void {
    this.eventHandlers.clear();
  }
}
