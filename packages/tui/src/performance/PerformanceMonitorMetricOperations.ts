import type { AlertManager } from './helpers/AlertManager';
import type { MetricsTracker, MetricFilter } from './helpers/MetricsTracker';
import type { PerformanceMetric, PerformanceMonitorConfig } from './types';

export class PerformanceMonitorMetricOperations {
  constructor(
    private config: PerformanceMonitorConfig,
    private metricsTracker: MetricsTracker,
    private alertManager: AlertManager
  ) {}

  public recordMetric(metric: PerformanceMetric): void {
    if (!this.config.enableMetrics) return;
    this.metricsTracker.recordMetric(metric);

    // Check for alerts
    if (this.config.enableAlerts) {
      const alert = this.alertManager.checkMetric(metric);
      if (alert) {
        // This would normally emit an alert event
        // but we don't have access to emit here
        // so we'll just add it to the alert manager
        this.alertManager.addAlert(alert);
      }
    }
  }

  public getMetrics(filter?: MetricFilter): PerformanceMetric[] {
    return this.metricsTracker.getMetrics(filter);
  }

  public clearMetrics(): void {
    this.metricsTracker.clear();
  }
}
