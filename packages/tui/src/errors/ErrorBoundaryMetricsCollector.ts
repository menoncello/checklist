import type {
  ErrorBoundaryMetrics,
  ErrorHistoryManager,
  ErrorState,
  StatePreservationManager,
} from './ErrorBoundaryHelpers';

export class ErrorBoundaryMetricsCollector {
  constructor(
    private historyManager: ErrorHistoryManager,
    private preservationManager: StatePreservationManager
  ) {}

  collectMetrics(state: ErrorState, _maxRetries: number): ErrorBoundaryMetrics {
    const history = this.historyManager.getHistory();
    const totalErrors = history.length;
    const retryAttempts = state.retryCount;
    const successfulRecoveries = history.filter((e) => e.recovered).length;
    const failedRecoveries = totalErrors - successfulRecoveries;

    // Calculate average retry time
    let averageRetryTime = 0;
    if (history.length > 1) {
      const times = history.map((e) => e.timestamp);
      const deltas = [];
      for (let i = 1; i < times.length; i++) {
        deltas.push(times[i] - times[i - 1]);
      }
      if (deltas.length > 0) {
        averageRetryTime = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      }
    }

    return {
      totalErrors,
      retryAttempts,
      successfulRecoveries,
      failedRecoveries,
      averageRetryTime,
      currentRetryCount: state.retryCount,
      hasActiveError: state.hasError,
      errorFrequency: this.historyManager.getErrorFrequency(),
      maxRetries: state.maxRetries,
    };
  }

  recordError(error: Error): void {
    // Record error metrics
    console.log('Recording error metrics for:', error.message);
  }

  updateErrorMetrics(retryCount: number): void {
    // Update error metrics
    console.log('Updating error metrics, retry count:', retryCount);
  }

  resetMetrics(): void {
    // Reset metrics
    this.historyManager.clear();
  }
}
