export interface ErrorMetrics {
  totalErrors: number;
  recoveries: number;
  failures: number;
  averageRecoveryTime: number;
  lastError?: Error;
  lastRecoveryTime?: Date;
}

export class ErrorBoundaryMetricsCollector {
  private metrics: ErrorMetrics = {
    totalErrors: 0,
    recoveries: 0,
    failures: 0,
    averageRecoveryTime: 0,
  };

  private recoveryTimes: number[] = [];

  recordError(error: Error): void {
    this.metrics.totalErrors++;
    this.metrics.lastError = error;
  }

  recordRecovery(recoveryTime: number): void {
    this.metrics.recoveries++;
    this.metrics.lastRecoveryTime = new Date();
    this.recoveryTimes.push(recoveryTime);

    // Calculate average recovery time
    const total = this.recoveryTimes.reduce((sum, time) => sum + time, 0);
    this.metrics.averageRecoveryTime = total / this.recoveryTimes.length;
  }

  recordFailure(): void {
    this.metrics.failures++;
  }

  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      totalErrors: 0,
      recoveries: 0,
      failures: 0,
      averageRecoveryTime: 0,
    };
    this.recoveryTimes = [];
  }

  // Additional methods needed by ErrorBoundaryCore
  updateErrorMetrics(_retryCount: number): void {
    // Default implementation for updating error metrics
    this.metrics.totalErrors++;
  }

  resetMetrics(): void {
    this.reset();
  }

  collectMetrics(): ErrorMetrics {
    return this.getMetrics();
  }
}
