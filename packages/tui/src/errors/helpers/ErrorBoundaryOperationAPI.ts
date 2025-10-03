import type { ErrorBoundaryEventManager } from '../ErrorBoundaryEventManager';
import type { ErrorBoundaryConfig, ErrorInfo } from '../ErrorBoundaryHelpers';
import type { ErrorBoundaryRetryManager } from '../ErrorBoundaryRetryManager';
import { ErrorBoundaryWrapper } from '../ErrorBoundaryWrapper';

interface ErrorBoundaryOperationComponents {
  wrapper: ErrorBoundaryWrapper;
  retryManager: ErrorBoundaryRetryManager;
  eventManager: ErrorBoundaryEventManager;
}

interface ErrorBoundaryInstance {
  on(event: string, handler: Function): void;
}

type ErrorBoundaryFactory = (
  config: ErrorBoundaryConfig
) => ErrorBoundaryInstance;

export class ErrorBoundaryOperationAPI {
  constructor(
    private config: ErrorBoundaryConfig,
    private components: ErrorBoundaryOperationComponents,
    private createErrorBoundaryInstance: ErrorBoundaryFactory
  ) {}

  wrap<T extends (...args: unknown[]) => unknown>(fn: T): T {
    return ErrorBoundaryWrapper.wrap(fn, (error, errorInfo) => {
      console.error('Error in wrapped function:', error, errorInfo);
    });
  }

  async wrapAsync<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T
  ): Promise<T> {
    return ErrorBoundaryWrapper.wrapAsync(fn, (error, errorInfo) => {
      console.error('Error in async wrapped function:', error, errorInfo);
    });
  }

  runWithBoundary(fn: () => void): void {
    try {
      fn();
    } catch (error) {
      console.error('Error in boundary:', error);
    }
  }

  async runAsyncWithBoundary(fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (error) {
      console.error('Error in async boundary:', error);
    }
  }

  async retryOperation<T>(
    operation: () => T,
    _maxRetries: number,
    _delay: number
  ): Promise<T> {
    return this.components.retryManager.retryOperation(operation);
  }

  createComponentBoundary(name: string): ErrorBoundaryInstance {
    const boundary = this.createErrorBoundaryInstance({ ...this.config });
    boundary.on('error', (data: { error: Error; errorInfo: ErrorInfo }) => {
      this.components.eventManager.emit('componentError', {
        component: name,
        ...data,
      });
    });
    return boundary;
  }
}
