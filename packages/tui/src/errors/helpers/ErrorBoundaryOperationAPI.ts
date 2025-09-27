import type { ErrorBoundaryEventManager } from '../ErrorBoundaryEventManager';
import type { ErrorBoundaryConfig, ErrorInfo } from '../ErrorBoundaryHelpers';
import type { ErrorBoundaryRetryManager } from '../ErrorBoundaryRetryManager';
import type { ErrorBoundaryWrapper } from '../ErrorBoundaryWrapper';

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
    return this.components.wrapper.wrap(fn);
  }

  async wrapAsync<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T
  ): Promise<T> {
    return this.components.wrapper.wrapAsync(fn);
  }

  runWithBoundary(fn: () => void): void {
    this.components.wrapper.runWithBoundary(fn);
  }

  async runAsyncWithBoundary(fn: () => Promise<void>): Promise<void> {
    return this.components.wrapper.runAsyncWithBoundary(fn);
  }

  async retryOperation<T>(
    operation: () => T,
    maxRetries: number,
    delay: number
  ): Promise<T> {
    return this.components.retryManager.retryOperation(
      operation,
      maxRetries,
      delay
    );
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
