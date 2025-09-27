import type { ErrorInfo } from './ErrorBoundaryHelpers';

export class ErrorBoundaryWrapper {
  private handleErrorFn: ((error: Error, errorInfo: ErrorInfo) => void) | null =
    null;

  constructor(handleErrorFn?: (error: Error, errorInfo: ErrorInfo) => void) {
    if (handleErrorFn != null) {
      this.handleErrorFn = handleErrorFn;
    }
  }

  wrap<T extends (...args: unknown[]) => unknown>(fn: T): T {
    const handleError = this.handleErrorFn;
    return ((...args: unknown[]) => {
      try {
        const result = fn(...args);

        // Handle promises
        if (result != null && typeof result === 'object' && 'then' in result) {
          return (result as Promise<unknown>).catch((error: Error) => {
            if (handleError != null) {
              handleError(error, {
                componentStack: `at wrapped function ${fn.name || 'anonymous'}`,
              });
            }
            throw error;
          });
        }

        return result;
      } catch (error) {
        if (handleError != null) {
          handleError(error as Error, {
            componentStack: `at wrapped function ${fn.name || 'anonymous'}`,
          });
        }
        throw error;
      }
    }) as T;
  }

  async wrapAsync<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T
  ): Promise<T> {
    const handleError = this.handleErrorFn;
    return (async (...args: unknown[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        if (handleError != null) {
          handleError(error as Error, {
            componentStack: `at async wrapped function ${fn.name || 'anonymous'}`,
          });
        }
        throw error;
      }
    }) as T;
  }

  runWithBoundary(fn: () => void): void {
    const handleError = this.handleErrorFn;
    try {
      fn();
    } catch (error) {
      if (handleError != null) {
        handleError(error as Error, {
          componentStack: `at runWithBoundary`,
        });
      }
      // Don't rethrow - boundary catches and handles the error
    }
  }

  async runAsyncWithBoundary(fn: () => Promise<void>): Promise<void> {
    const handleError = this.handleErrorFn;
    try {
      await fn();
    } catch (error) {
      if (handleError != null) {
        handleError(error as Error, {
          componentStack: `at runAsyncWithBoundary`,
        });
      }
      // Don't rethrow - boundary catches and handles the error
    }
  }

  static getFallbackUI(
    hasError: boolean,
    error: Error | null,
    errorInfo: ErrorInfo | null,
    fallbackRenderer: (error: Error, errorInfo: ErrorInfo) => string
  ): string {
    if (!hasError || !error) {
      return '';
    }

    try {
      return fallbackRenderer(error, errorInfo ?? {});
    } catch (_renderError) {
      // Emergency fallback when custom renderer fails
      return `ERROR BOUNDARY FAILURE\n${error.message}`;
    }
  }
}
