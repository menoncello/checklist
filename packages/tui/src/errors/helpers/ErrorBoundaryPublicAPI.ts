import type { ErrorBoundaryCheckpointManager } from '../ErrorBoundaryCheckpointManager';
import type { ErrorBoundaryEventManager } from '../ErrorBoundaryEventManager';
import type {
  ErrorBoundaryConfig,
  ErrorBoundaryMetrics,
  ErrorHistoryEntry,
  ErrorHistoryManager,
  ErrorInfo,
  ErrorState,
  ErrorStateManager,
  StatePreservationManager,
} from '../ErrorBoundaryHelpers';
import type { ErrorBoundaryMetricsCollector } from '../ErrorBoundaryMetricsCollector';
import type { ErrorBoundaryOperations } from '../ErrorBoundaryOperations';
import type { ErrorBoundaryStateHandler } from '../ErrorBoundaryStateHandler';

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
    return this.components.stateManager.getError();
  }

  getErrorInfo(): ErrorInfo | null {
    return this.components.stateManager.getErrorInfo();
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
  preserveState(key: string, value: unknown): void {
    this.components.preservationManager.preserveState(key, value);
  }

  getPreservedState<T>(key: string): T | null {
    return this.components.preservationManager.getPreservedState<T>(key);
  }

  clearPreservedState(key?: string): void {
    this.components.preservationManager.clearPreservedState(key);
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
    return this.components.metricsCollector.collectMetrics(
      this.components.stateHandler.getState(),
      this.config.maxRetries
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
