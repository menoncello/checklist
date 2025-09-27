import type { ErrorBoundaryConfig, ErrorInfo } from './ErrorBoundaryHelpers';

export class ErrorBoundaryOperations {
  private errorCallback: ((error: Error, errorInfo: ErrorInfo) => void) | null =
    null;
  private retryCallback:
    | ((attempt: number, maxRetries: number) => void)
    | null = null;
  private recoveryCallback: (() => void) | null = null;

  constructor(private config: ErrorBoundaryConfig) {
    this.errorCallback = config.onError ?? null;
    this.retryCallback = config.onRetry ?? null;
    this.recoveryCallback = config.onRecovery ?? null;
  }

  updateConfig(config: ErrorBoundaryConfig): void {
    this.config = config;
    this.errorCallback = config.onError ?? null;
    this.retryCallback = config.onRetry ?? null;
    this.recoveryCallback = config.onRecovery ?? null;
  }

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
    return retryCount < this.config.maxRetries;
  }

  getRemainingRetries(retryCount: number): number {
    return Math.max(0, this.config.maxRetries - retryCount);
  }

  logError(error: Error, errorInfo: ErrorInfo, retryCount: number): void {
    if (this.config.logErrors === true) {
      console.error('Error caught by ErrorBoundary:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        errorInfo,
        retryCount,
        maxRetries: this.config.maxRetries,
      });
    }
  }
}
