import {
  ErrorInfo,
  ErrorState,
  ErrorBoundaryConfig,
} from './ErrorBoundaryTypes';
import { ErrorBoundaryUtils } from './ErrorBoundaryUtils';

export class ErrorBoundaryHandlers {
  static handleError(options: {
    error: Error;
    errorInfo: ErrorInfo;
    config: ErrorBoundaryConfig;
    state: ErrorState;
    updateStateFn: (newState: ErrorState) => void;
    recordErrorFn: (
      error: Error,
      errorInfo: ErrorInfo,
      errorId: string
    ) => void;
    processHandlingFn: (error: Error, errorInfo: ErrorInfo) => Promise<void>;
  }): void {
    if (options.config.logErrors) {
      ErrorBoundaryUtils.logError(options.error, options.errorInfo);
    }

    const errorId = ErrorBoundaryUtils.generateErrorId();
    const newState: ErrorState = {
      hasError: true,
      error: options.error,
      errorInfo: options.errorInfo,
      errorId,
      timestamp: Date.now(),
      retryCount: options.state.retryCount,
      maxRetries: options.config.maxRetries,
    };

    options.updateStateFn(newState);
    options.recordErrorFn(options.error, options.errorInfo, errorId);
    options.processHandlingFn(options.error, options.errorInfo);
  }

  static executeErrorCallback(
    error: Error,
    errorInfo: ErrorInfo,
    onError?: (error: Error, errorInfo: ErrorInfo) => void
  ): void {
    try {
      if (onError) {
        onError(error, errorInfo);
      }
    } catch (callbackError) {
      console.error('Error in error callback:', callbackError);
    }
  }

  static executeRegisteredHandlers(
    error: Error,
    errorInfo: ErrorInfo,
    handlers: Set<Function> | undefined
  ): void {
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(error, errorInfo);
        } catch (handlerError) {
          console.error('Error in registered error handler:', handlerError);
        }
      });
    }
  }

  static scheduleRetry(options: {
    error: Error;
    errorInfo: ErrorInfo;
    retryDelay: number;
    retryTimer: Timer | null;
    performRetryFn: (error: Error, errorInfo: ErrorInfo) => void;
  }): Timer {
    if (options.retryTimer) {
      clearTimeout(options.retryTimer);
    }

    return setTimeout(() => {
      options.performRetryFn(options.error, options.errorInfo);
    }, options.retryDelay);
  }

  static performRetry(
    state: ErrorState,
    config: ErrorBoundaryConfig,
    resetFn: () => void,
    emitFn: (event: string, data?: unknown) => void
  ): void {
    state.retryCount++;

    if (config.onRetry) {
      config.onRetry(state.retryCount, config.maxRetries);
    }

    emitFn('retryAttempt', {
      attempt: state.retryCount,
      maxRetries: config.maxRetries,
    });

    // Reset error state for retry
    resetFn();
  }

  static runWithBoundary(
    fn: () => void,
    handleErrorFn: (error: Error) => void
  ): void {
    try {
      fn();
    } catch (error) {
      handleErrorFn(error as Error);
    }
  }

  static async runAsyncWithBoundary(
    fn: () => Promise<void>,
    handleErrorFn: (error: Error) => void
  ): Promise<void> {
    try {
      await fn();
    } catch (error) {
      handleErrorFn(error as Error);
    }
  }

  static createComponentBoundary(
    name: string,
    config: ErrorBoundaryConfig,
    ErrorBoundaryClass: new (config: ErrorBoundaryConfig) => unknown
  ): unknown {
    const componentConfig = {
      ...config,
      fallbackRenderer: (error: Error, errorInfo: ErrorInfo) => {
        const componentErrorInfo =
          ErrorBoundaryUtils.createComponentErrorInfo(name);
        return config.fallbackRenderer(error, {
          ...errorInfo,
          ...componentErrorInfo,
        });
      },
    };

    return new ErrorBoundaryClass(componentConfig);
  }
}
