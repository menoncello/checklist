import {
  ErrorInfo,
  ErrorState,
  ErrorHistoryEntry,
  ErrorBoundaryConfig,
  ErrorMetrics,
} from './ErrorBoundaryTypes';

export class ErrorBoundaryUtils {
  static createDefaultConfig(): ErrorBoundaryConfig {
    return {
      maxRetries: 3,
      retryDelay: 1000,
      logErrors: true,
      fallbackRenderer: this.defaultFallbackRenderer,
      enableStatePreservation: true,
    };
  }

  static createInitialState(): ErrorState {
    return {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      timestamp: 0,
      retryCount: 0,
      maxRetries: 3,
    };
  }

  static generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static logError(error: Error, errorInfo: ErrorInfo): void {
    const errorData = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      errorInfo,
      retryCount: 0,
    };

    console.error('Error caught by ErrorBoundary:', errorData);

    // Browser logging not applicable in Node.js TUI environment
    // External logging would be handled through Node.js logging services
  }

  static recordError(
    error: Error,
    errorInfo: ErrorInfo,
    errorId: string,
    options: { retryCount: number; history: ErrorHistoryEntry[] }
  ): void {
    const entry: ErrorHistoryEntry = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorInfo,
      errorId,
      timestamp: Date.now(),
      retryCount: options.retryCount,
    };

    options.history.push(entry);

    // Keep only the last 50 errors
    if (options.history.length > 50) {
      options.history.shift();
    }
  }

  static calculateMetrics(
    history: ErrorHistoryEntry[],
    timeWindow: number = 3600000 // 1 hour
  ): ErrorMetrics {
    const now = Date.now();
    const recentErrors = history.filter(
      (entry) => now - entry.timestamp < timeWindow
    );

    const basicMetrics = this.calculateBasicMetrics(
      history,
      recentErrors,
      timeWindow
    );
    const retryMetrics = this.calculateRetryMetrics(history);
    const averageRecoveryTime = this.calculateAverageRecoveryTime(history);
    const mostCommonErrors = this.findMostCommonErrors(history);

    return {
      ...basicMetrics,
      ...retryMetrics,
      averageRecoveryTime,
      mostCommonErrors,
    };
  }

  private static calculateBasicMetrics(
    history: ErrorHistoryEntry[],
    recentErrors: ErrorHistoryEntry[],
    timeWindow: number
  ) {
    const totalErrors = history.length;
    const recentErrorCount = recentErrors.length;
    const errorRate =
      timeWindow > 0 ? (recentErrorCount / timeWindow) * 1000 * 60 : 0; // errors per minute

    return { totalErrors, recentErrors: recentErrorCount, errorRate };
  }

  private static calculateRetryMetrics(history: ErrorHistoryEntry[]) {
    const retriedErrors = history.filter((entry) => entry.retryCount > 0);
    const retrySuccessRate =
      retriedErrors.length > 0
        ? retriedErrors.filter((entry) => entry.retryCount < 3).length /
          retriedErrors.length
        : 0;

    return { retrySuccessRate };
  }

  private static findMostCommonErrors(history: ErrorHistoryEntry[]) {
    const errorCounts = new Map<string, number>();
    history.forEach((entry) => {
      const errorKey = `${entry.error.name}: ${entry.error.message}`;
      errorCounts.set(errorKey, (errorCounts.get(errorKey) ?? 0) + 1);
    });

    return Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error, count]) => ({ error, count }));
  }

  private static calculateAverageRecoveryTime(
    history: ErrorHistoryEntry[]
  ): number {
    // This is a simplified calculation
    // In practice, you'd track recovery times more precisely
    const retriedErrors = history.filter((entry) => entry.retryCount > 0);
    if (retriedErrors.length === 0) return 0;

    return (
      retriedErrors.reduce((sum, entry) => sum + entry.retryCount * 1000, 0) /
      retriedErrors.length
    );
  }

  static sanitizeErrorForLogging(error: Error): Record<string, unknown> {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      // Remove any potentially sensitive data
    };
  }

  static shouldRetry(
    error: Error,
    retryCount: number,
    maxRetries: number
  ): boolean {
    if (retryCount >= maxRetries) return false;

    // Don't retry certain types of errors
    if (error.name === 'SyntaxError') return false;
    if (error.message.includes('Permission denied')) return false;

    return true;
  }

  static defaultFallbackRenderer(error: Error, _errorInfo: ErrorInfo): string {
    return `
┌─ Error Boundary ─────────────────────┐
│ An error occurred in the application │
│                                      │
│ Error: ${error.name}                 │
│ Message: ${error.message.slice(0, 30)}...│
│                                      │
│ Press 'r' to retry or 'q' to quit    │
└──────────────────────────────────────┘
`;
  }

  static createComponentErrorInfo(componentName: string): ErrorInfo {
    return {
      componentStack: `at ${componentName}`,
      errorBoundary: 'ErrorBoundary',
      errorBoundaryStack: new Error().stack,
    };
  }

  static mergeConfigs(
    base: ErrorBoundaryConfig,
    override: Partial<ErrorBoundaryConfig>
  ): ErrorBoundaryConfig {
    return { ...base, ...override };
  }

  static isRetriableError(error: Error): boolean {
    // Check if error is likely to be resolved by retrying
    const retriablePatterns = [
      /network/i,
      /timeout/i,
      /temporary/i,
      /unavailable/i,
    ];

    return retriablePatterns.some(
      (pattern) => pattern.test(error.message) || pattern.test(error.name)
    );
  }
}
