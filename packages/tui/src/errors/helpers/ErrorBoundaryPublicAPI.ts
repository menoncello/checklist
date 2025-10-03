import type { ErrorBoundaryCheckpointManager } from '../ErrorBoundaryCheckpointManager';
import type { ErrorBoundaryEventManager } from '../ErrorBoundaryEventManager';
import type {
  ErrorBoundaryConfig,
  ErrorBoundaryMetrics,
  ErrorHistoryEntry,
  ErrorHistoryManager,
  ErrorInfo,
  StatePreservationManager,
} from '../ErrorBoundaryHelpers';
import type {
  ErrorState as ErrorStateFromHelpers,
  ErrorStateManager,
} from '../ErrorBoundaryHelpers';
import type { ErrorBoundaryMetricsCollector } from '../ErrorBoundaryMetricsCollector';
import type { ErrorBoundaryOperations } from '../ErrorBoundaryOperations';
import type { ErrorBoundaryStateHandler } from '../ErrorBoundaryStateHandler';
import type { ErrorState } from '../ErrorBoundaryStateHandler';

interface ErrorBoundaryPublicAPIComponents {
  stateManager: ErrorStateManager;
  historyManager: ErrorHistoryManager;
  preservationManager: StatePreservationManager;
  checkpointManager: ErrorBoundaryCheckpointManager;
  eventManager: ErrorBoundaryEventManager;
  metricsCollector: ErrorBoundaryMetricsCollector;
  operations: ErrorBoundaryOperations;
  stateHandler: ErrorBoundaryStateHandler;
}

export class ErrorBoundaryPublicAPI {
  constructor(
    private components: ErrorBoundaryPublicAPIComponents,
    private config: ErrorBoundaryConfig
  ) {}

  // State getter methods
  hasError(): boolean {
    return this.components.stateHandler.hasError();
  }

  getError(): Error | null {
    const state =
      this.components.stateManager.getState() as ErrorStateFromHelpers;
    return state.error ?? null;
  }

  getErrorInfo(): ErrorInfo | null {
    const state =
      this.components.stateManager.getState() as ErrorStateFromHelpers;
    return state.errorInfo;
  }

  getErrorState(): ErrorState {
    return this.components.stateHandler.getState();
  }

  getState(): ErrorState {
    return this.components.stateHandler.getState();
  }

  // Retry methods
  canRetry(): boolean {
    return this.components.operations.canRetry(
      this.components.stateHandler.getRetryCount()
    );
  }

  getRemainingRetries(): number {
    return this.components.operations.getRemainingRetries(
      this.components.stateHandler.getRetryCount()
    );
  }

  resetRetryCount(): void {
    this.components.stateManager.resetRetryCount();
  }

  // History methods
  getErrorHistory(): ErrorHistoryEntry[] {
    return this.components.historyManager.getHistory();
  }

  getRecentErrors(limit: number = 10): ErrorHistoryEntry[] {
    return this.components.historyManager.getRecentErrors(limit);
  }

  getErrorFrequency(): number {
    return this.components.historyManager.getErrorFrequency();
  }

  // State preservation methods
  preserveState(value: unknown): void {
    this.components.preservationManager.preserveState(value);
  }

  getPreservedState<T>(): T | null {
    const result = this.components.preservationManager.getPreservedState();
    return result as T | null;
  }

  clearPreservedState(): void {
    this.components.preservationManager.clearPreservedState();
  }

  preserveCurrentState(): void {
    this.components.stateHandler.preserveCurrentState();
  }

  restorePreservedState(): void {
    const restoredState = this.components.stateHandler.restorePreservedState();
    if (restoredState != null) {
      this.components.eventManager.emit('stateRestored', restoredState);
    }
  }

  // Metrics and configuration
  getMetrics(): ErrorBoundaryMetrics {
    const state = this.components.stateHandler.getState();
    const adaptedState = {
      hasError: state.hasError ?? false,
      error: state.error,
      errorInfo:
        state.errorInfo != null && typeof state.errorInfo === 'object'
          ? ({
              componentStack: '',
              errorBoundary: '',
              eventType: '',
              ...(state.errorInfo as Record<string, unknown>),
            } as ErrorInfo)
          : ({
              componentStack: '',
              errorBoundary: '',
              eventType: '',
            } as ErrorInfo),
      errorId: state.errorId ?? '',
      timestamp: state.timestamp ? new Date(state.timestamp).getTime() : 0,
      retryCount: state.retryCount ?? 0,
      maxRetries: state.maxRetries ?? 3,
    };
    return this.components.metricsCollector.collectMetrics(
      adaptedState,
      this.config.maxRetries ?? 3
    );
  }

  getConfig(): ErrorBoundaryConfig {
    return { ...this.config };
  }

  // Event handling
  onError(handler: (error: Error, errorInfo: ErrorInfo) => void): void {
    this.components.eventManager.on(
      'error',
      ({ error, errorInfo }: { error: Error; errorInfo: ErrorInfo }) =>
        handler(error, errorInfo)
    );
  }

  on(event: string, handler: Function): void {
    this.components.eventManager.on(event, handler);
  }

  off(event: string, handler: Function): void {
    this.components.eventManager.off(event, handler);
  }
}
