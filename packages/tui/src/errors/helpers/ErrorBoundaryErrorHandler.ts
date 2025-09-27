import type { ErrorBoundaryEventManager } from '../ErrorBoundaryEventManager';
import type {
  ErrorBoundaryConfig,
  ErrorInfo,
  ErrorRecordParams,
  ErrorUpdateParams,
} from '../ErrorBoundaryHelpers';
import type { ErrorBoundaryOperations } from '../ErrorBoundaryOperations';
import type { ErrorBoundaryRetryManager } from '../ErrorBoundaryRetryManager';
import type { ErrorBoundaryStateHandler } from '../ErrorBoundaryStateHandler';
import { ErrorBoundaryUtils } from '../ErrorBoundaryUtils';

interface ErrorBoundaryErrorHandlerComponents {
  stateHandler: ErrorBoundaryStateHandler;
  operations: ErrorBoundaryOperations;
  retryManager: ErrorBoundaryRetryManager;
  eventManager: ErrorBoundaryEventManager;
}

export class ErrorBoundaryErrorHandler {
  constructor(
    private config: ErrorBoundaryConfig,
    private components: ErrorBoundaryErrorHandlerComponents
  ) {}

  handleError(error: Error, errorInfo: ErrorInfo = {}): void {
    const errorId = ErrorBoundaryUtils.generateErrorId();
    const timestamp = Date.now();
    const params = { error, errorInfo, errorId, timestamp };

    this.updateErrorState(params);
    this.recordError(params);
    this.performErrorHandlingTasks(error, errorInfo);
    this.components.eventManager.emit('error', {
      error,
      errorInfo,
      errorId,
      timestamp,
    });
    this.handleRetryLogic(error, errorInfo);
  }

  retry(): boolean {
    if (!this.canRetry()) {
      return false;
    }
    this.attemptRetry();
    return true;
  }

  clearError(): void {
    this.components.retryManager.cancelRetry();
    const hadError = this.components.stateHandler.reset(this.config.maxRetries);

    if (hadError === true) {
      this.components.operations.executeRecoveryCallback();
      this.components.eventManager.emit('recovery');
    }
  }

  private updateErrorState(params: ErrorUpdateParams): void {
    this.components.stateHandler.updateErrorState(params);
  }

  private recordError(params: ErrorRecordParams): void {
    this.components.stateHandler.recordError(params);
  }

  private performErrorHandlingTasks(error: Error, errorInfo: ErrorInfo): void {
    this.components.operations.logError(
      error,
      errorInfo,
      this.components.stateHandler.getRetryCount()
    );
    this.components.stateHandler.preserveCurrentState();
    this.components.operations.executeErrorCallback(error, errorInfo);
  }

  private handleRetryLogic(error: Error, errorInfo: ErrorInfo): void {
    if (
      this.components.operations.canRetry(
        this.components.stateHandler.getRetryCount()
      ) === true
    ) {
      this.components.retryManager.scheduleRetry(this.config.retryDelay);
    } else {
      this.components.eventManager.emit('errorBoundaryExhausted', {
        error,
        errorInfo,
      });
    }
  }

  handleRetry(): void {
    this.attemptRetry();
  }

  private attemptRetry(): void {
    this.components.stateHandler.incrementRetryCount();

    this.components.operations.executeRetryCallback(
      this.components.stateHandler.getRetryCount(),
      this.config.maxRetries
    );

    this.components.eventManager.emit('retry', {
      attempt: this.components.stateHandler.getRetryCount(),
      maxRetries: this.config.maxRetries,
    });

    const restoredState = this.components.stateHandler.restorePreservedState();
    if (restoredState != null) {
      this.components.eventManager.emit('stateRestored', restoredState);
    }

    this.clearError();
  }

  private canRetry(): boolean {
    return this.components.operations.canRetry(
      this.components.stateHandler.getRetryCount()
    );
  }
}
