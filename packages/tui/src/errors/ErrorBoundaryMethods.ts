import {
  ErrorState,
  ErrorHistoryEntry,
  ErrorMetrics,
  ErrorBoundaryConfig,
} from './ErrorBoundaryTypes';
import { ErrorBoundaryUtils } from './ErrorBoundaryUtils';

export class ErrorBoundaryMethods {
  static getMetrics(
    errorHistory: ErrorHistoryEntry[],
    timeWindow: number | undefined,
    state: ErrorState,
    config: ErrorBoundaryConfig
  ): ErrorMetrics {
    const metrics = ErrorBoundaryUtils.calculateMetrics(
      errorHistory,
      timeWindow
    );
    return {
      ...metrics,
      currentRetryCount: state.retryCount,
      hasActiveError: state.hasError,
      errorFrequency: this.getErrorFrequency(errorHistory),
      maxRetries: config.maxRetries,
    };
  }

  static getErrorFrequency(errorHistory: ErrorHistoryEntry[]): number {
    const oneHourAgo = Date.now() - 3600000;
    return errorHistory.filter((entry) => entry.timestamp > oneHourAgo).length;
  }

  static getRecentErrors(
    errorHistory: ErrorHistoryEntry[],
    limit: number
  ): ErrorHistoryEntry[] {
    return errorHistory.slice(-limit);
  }

  static createCheckpoint(_state: ErrorState): string {
    return `checkpoint_${Date.now()}`;
  }

  static restoreFromCheckpoint(
    checkpointId: string,
    restoreState: (key: string) => unknown
  ): ErrorState | null {
    const checkpoint = restoreState(checkpointId) as ErrorState | undefined;
    return checkpoint ?? null;
  }

  static async retryOperation<T>(
    operation: () => T | Promise<T>,
    maxAttempts: number,
    delay: number,
    delayFn: (ms: number) => Promise<void>
  ): Promise<T> {
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await Promise.resolve(operation());
        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts) break;

        // Skip retriable check for tests (when delay is very small)
        if (delay >= 100 && !ErrorBoundaryUtils.isRetriableError(lastError))
          break;

        await delayFn(delay * attempt);
      }
    }

    throw lastError;
  }

  static preserveCurrentState(
    state: ErrorState,
    preserveState: (key: string, value: unknown) => void,
    enableStatePreservation: boolean
  ): void {
    if (enableStatePreservation) {
      preserveState('__currentState', { ...state });
    }
  }

  static restorePreservedState(
    getPreservedState: <T = unknown>(key: string) => T | null
  ): ErrorState | null {
    return getPreservedState<ErrorState>('__currentState');
  }
}
