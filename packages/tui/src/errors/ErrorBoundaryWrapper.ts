import { ErrorInfo } from './ErrorBoundaryTypes';

export class ErrorBoundaryWrapper {
  static wrap<T extends (...args: unknown[]) => unknown>(
    fn: T,
    handleErrorFn: (error: Error, errorInfo: ErrorInfo) => void
  ): T {
    return ((...args: unknown[]) => {
      try {
        const result = fn(...args);

        // Handle promises
        if (result != null && typeof result === 'object' && 'then' in result) {
          return (result as Promise<unknown>).catch((error: Error) => {
            handleErrorFn(error, {
              componentStack: `at wrapped function ${fn.name || 'anonymous'}`,
            });
            throw error;
          });
        }

        return result;
      } catch (error) {
        handleErrorFn(error as Error, {
          componentStack: `at wrapped function ${fn.name || 'anonymous'}`,
        });
        throw error;
      }
    }) as T;
  }

  static async wrapAsync<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    handleErrorFn: (error: Error, errorInfo: ErrorInfo) => void
  ): Promise<T> {
    return (async (...args: unknown[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        handleErrorFn(error as Error, {
          componentStack: `at async wrapped function ${fn.name || 'anonymous'}`,
        });
        throw error;
      }
    }) as T;
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
