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
    this.stateHandler.reset(this.config.maxRetries ?? 3);
    const hadError = this.stateHandler.hasError();

    if (hadError === true) {
      this.operations.executeRecoveryCallback();
      this.eventManager.emit('recovery');
    }
  }

  public recordError(params: ErrorRecordParams): void {
    // Add recordError method to metrics collector if it doesn't exist
    if (
      'recordError' in this.metricsCollector &&
      typeof (this.metricsCollector as unknown as Record<string, unknown>)
        .recordError === 'function'
    ) {
      (
        this.metricsCollector as { recordError: (error: Error) => void }
      ).recordError(params.error);
    }
    this.stateHandler.recordError(params);
    this.checkpointManager.createCheckpoint(this.stateHandler.getState());

    if (this.config.preserveStateOnError === true) {
      this.statePreservation.preserveState(
        params.componentStack ?? 'error',
        params
      );
    }
  }

  public updateError(params: ErrorUpdateParams): void {
    this.stateHandler.updateErrorState(params);
    // Add updateErrorMetrics method to metrics collector if it doesn't exist
    if (
      'updateErrorMetrics' in this.metricsCollector &&
      typeof (this.metricsCollector as unknown as Record<string, unknown>)
        .updateErrorMetrics === 'function'
    ) {
      (
        this.metricsCollector as { updateErrorMetrics: (count: number) => void }
      ).updateErrorMetrics(params.retryCount ?? 0);
    }
  }

  public performCleanup(): void {
    // Add missing methods to retry manager
    if (
      'clearRetryTimer' in this.retryManager &&
      typeof (this.retryManager as unknown as Record<string, unknown>)
        .clearRetryTimer === 'function'
    ) {
      (this.retryManager as { clearRetryTimer: () => void }).clearRetryTimer();
    } else {
      this.retryManager.cancelRetry();
    }

    // Add missing methods to event manager
    if (
      'removeAllListeners' in this.eventManager &&
      typeof (this.eventManager as unknown as Record<string, unknown>)
        .removeAllListeners === 'function'
    ) {
      (
        this.eventManager as { removeAllListeners: () => void }
      ).removeAllListeners();
    } else {
      this.eventManager.clear();
    }

    // Add missing methods to metrics collector
    if (
      'resetMetrics' in this.metricsCollector &&
      typeof (this.metricsCollector as unknown as Record<string, unknown>)
        .resetMetrics === 'function'
    ) {
      (this.metricsCollector as { resetMetrics: () => void }).resetMetrics();
    }

    this.checkpointManager.clearCheckpoints();
  }

  // Checkpoint management methods
  public createCheckpoint(): string {
    const state = this.stateHandler.getState();
    return this.checkpointManager.createCheckpoint(state);
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
        errorId: checkpointState.errorId ?? 'unknown',
        timestamp: Date.now(),
      };

      this.stateHandler.reset(this.config.maxRetries ?? 3);
      if (checkpointState.hasError === true) {
        this.stateHandler.updateError(params);
      }

      this.eventManager.emit('checkpointRestored', { checkpointId });
      return true;
    }

    return false;
  }

  // State preservation methods
  public preserveState(_key: string, value: unknown): void {
    this.statePreservation.preserve(value);
  }

  public getPreservedState<T>(_key: string): T | null {
    return this.statePreservation.restore() as T | null;
  }

  public restorePreservedState(): unknown {
    return this.stateHandler.restorePreservedState();
  }

  public clearPreservedState(key?: string): void {
    if (key !== undefined) {
      // For specific key clearing, we would need to implement that in StatePreservation
      this.statePreservation.clear();
    } else {
      this.statePreservation.clear();
    }
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
      timestamp:
        typeof state.timestamp === 'number' ? state.timestamp : Date.now(),
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
    this.stateHandler.reset(this.config.maxRetries ?? 3);
    this.performCleanup();
  }

  public destroy(): void {
    this.performCleanup();
  }
}
