import { ErrorBoundaryCheckpointManager } from './ErrorBoundaryCheckpointManager';
import { ErrorBoundaryEventManager } from './ErrorBoundaryEventManager';
import {
  ErrorBoundaryConfig,
  ErrorInfo,
  ErrorRecordParams,
  ErrorState,
  ErrorUpdateParams,
  StatePreservationManager,
} from './ErrorBoundaryHelpers';
import { ErrorBoundaryMetricsCollector } from './ErrorBoundaryMetricsCollector';
import { ErrorBoundaryOperations } from './ErrorBoundaryOperations';
import { ErrorBoundaryRetryManager } from './ErrorBoundaryRetryManager';
import { ErrorBoundaryStateHandler } from './ErrorBoundaryStateHandler';

interface ErrorBoundaryCoreComponents {
  stateHandler: ErrorBoundaryStateHandler;
  operations: ErrorBoundaryOperations;
  retryManager: ErrorBoundaryRetryManager;
  eventManager: ErrorBoundaryEventManager;
  metricsCollector: ErrorBoundaryMetricsCollector;
  checkpointManager: ErrorBoundaryCheckpointManager;
  statePreservation: StatePreservationManager;
}

export class ErrorBoundaryCore {
  private stateHandler: ErrorBoundaryStateHandler;
  private operations: ErrorBoundaryOperations;
  private retryManager: ErrorBoundaryRetryManager;
  private eventManager: ErrorBoundaryEventManager;
  private metricsCollector: ErrorBoundaryMetricsCollector;
  private checkpointManager: ErrorBoundaryCheckpointManager;
  private statePreservation: StatePreservationManager;

  constructor(
    private config: ErrorBoundaryConfig,
    components: ErrorBoundaryCoreComponents
  ) {
    this.stateHandler = components.stateHandler;
    this.operations = components.operations;
    this.retryManager = components.retryManager;
    this.eventManager = components.eventManager;
    this.metricsCollector = components.metricsCollector;
    this.checkpointManager = components.checkpointManager;
    this.statePreservation = components.statePreservation;
  }

  public handleRetryLogic(error: Error, errorInfo: ErrorInfo): void {
    if (
      this.operations.canRetry !== undefined &&
      this.operations.canRetry(this.stateHandler.getRetryCount()) === true
    ) {
      this.retryManager.scheduleRetry(this.config.retryDelay ?? 1000);
    } else {
      this.eventManager.emit('errorBoundaryExhausted', { error, errorInfo });
    }
  }

  public attemptRetry(): void {
    this.stateHandler.incrementRetryCount();

    this.operations.executeRetryCallback(
      this.stateHandler.getRetryCount(),
      this.config.maxRetries ?? 3
    );

    const restoredState = this.stateHandler.restorePreservedState();
    if (restoredState !== null && restoredState !== undefined) {
      this.eventManager.emit('stateRestored', restoredState);
    }

    this.clearError();
  }

  public clearError(): void {
    this.stateHandler.reset();
    const hadError = this.stateHandler.hasError();

    if (hadError === true) {
      this.operations.executeRecoveryCallback();
      this.eventManager.emit('recovery');
    }
  }

  public recordError(params: ErrorRecordParams): void {
    this.metricsCollector.recordError(params.error);
    this.stateHandler.recordError(params.error, params.errorInfo);
    this.checkpointManager.createCheckpoint(
      'error-' + Date.now().toString(),
      this.stateHandler.getState()
    );

    if (this.config.preserveStateOnError === true) {
      this.statePreservation.preserveState(params.componentStack);
    }
  }

  public updateError(params: ErrorUpdateParams): void {
    this.stateHandler.updateError(params);
    this.metricsCollector.updateErrorMetrics(params.retryCount ?? 0);
  }

  public performCleanup(): void {
    this.retryManager.clearRetryTimer();
    this.eventManager.removeAllListeners();
    this.metricsCollector.resetMetrics();
    this.checkpointManager.clearCheckpoints();
  }

  // Checkpoint management methods
  public createCheckpoint(): string {
    const id = 'checkpoint-' + Date.now().toString();
    this.checkpointManager.createCheckpoint(id, this.stateHandler.getState());
    return id;
  }

  public restoreFromCheckpoint(checkpointId: string): boolean {
    const checkpoint =
      this.checkpointManager.restoreFromCheckpoint(checkpointId);

    if (checkpoint !== null && checkpoint !== undefined) {
      const checkpointState = checkpoint as unknown as {
        error?: Error;
        errorInfo?: unknown;
        errorId?: string;
        hasError?: boolean;
      };
      const params: ErrorUpdateParams = {
        error: checkpointState.error ?? new Error('Unknown error'),
        errorInfo: (checkpointState.errorInfo ?? {}) as ErrorInfo,
        errorId: checkpointState.errorId,
      };

      this.stateHandler.reset();
      if (checkpointState.hasError === true) {
        this.stateHandler.updateError(params);
      }

      this.eventManager.emit('checkpointRestored', { checkpointId });
      return true;
    }

    return false;
  }

  // State preservation methods
  public preserveState(key: string, _value: unknown): void {
    this.statePreservation.preserveState(key);
  }

  public getPreservedState<T>(_key: string): T | null {
    return this.statePreservation.getPreservedState() as T | null;
  }

  public restorePreservedState(): unknown {
    return this.stateHandler.restorePreservedState();
  }

  public clearPreservedState(_key?: string): void {
    this.statePreservation.clearPreservedState();
  }

  // Getter methods
  public hasError(): boolean {
    return this.stateHandler.hasError();
  }

  public getErrorState(): ErrorState {
    const state = this.stateHandler.getState();
    return {
      hasError: state.hasError,
      error: state.error ?? null,
      errorInfo: (state.errorInfo ?? {}) as ErrorInfo,
      errorId: state.errorId ?? '',
      timestamp: state.timestamp?.getTime() ?? 0,
      retryCount: state.retryCount ?? 0,
      maxRetries: state.maxRetries ?? 3,
    };
  }

  // Configuration and lifecycle methods
  public updateConfig(newConfig: Partial<ErrorBoundaryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.stateHandler.updateStatePreservationConfig(
      this.config.enableStatePreservation
    );
  }

  public getConfig(): ErrorBoundaryConfig {
    return { ...this.config };
  }

  public reset(): void {
    this.stateHandler.reset();
    this.performCleanup();
  }

  public destroy(): void {
    this.performCleanup();
  }
}
