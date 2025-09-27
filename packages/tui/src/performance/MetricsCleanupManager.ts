import type { MetricPoint, MetricsCollectorConfig } from './MetricsTypes';

export class MetricsCleanupManager {
  private config: MetricsCollectorConfig;
  private emit: (event: string, data?: unknown) => void;

  constructor(
    config: MetricsCollectorConfig,
    emit: (event: string, data?: unknown) => void
  ) {
    this.config = config;
    this.emit = emit;
  }

  performCleanup(series: Map<string, MetricPoint[]>): number {
    const cutoff = this.getCutoffTime();
    let cleanedPoints = 0;

    for (const [name, points] of series.entries()) {
      const originalLength = points.length;
      const filteredPoints = points.filter((point) => point.timestamp > cutoff);
      cleanedPoints += originalLength - filteredPoints.length;
      series.set(name, filteredPoints);
    }

    this.emit('cleanupCompleted', { cleanedPoints });
    return cleanedPoints;
  }

  getCutoffTime(): number {
    return Date.now() - this.config.retentionPeriod;
  }

  startPeriodicCleanup(): void {
    setInterval(() => {
      this.emit('periodicCleanup');
    }, this.config.retentionPeriod / 10);
  }

  cleanup(): void {
    // Cleanup implementation
  }
}
