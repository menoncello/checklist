import type {
  PerformanceMetric,
  PerformanceBenchmark,
  PerformanceAlert,
  PerformanceMonitorConfig,
} from './types';

export interface AlertManager {
  addThreshold: (threshold: unknown) => void;
  removeThreshold: (name: string) => boolean;
  getAlerts: (level?: string) => unknown[];
  checkMetric: (metric: PerformanceMetric) => PerformanceAlert | null;
}

export interface MetricsTracker {
  recordMetric: (metric: PerformanceMetric) => void;
  getMetrics: (filter?: unknown) => PerformanceMetric[];
  startAutoSampling: () => void;
  stopAutoSampling: () => void;
}

export interface BenchmarkManager {
  getBenchmarks: (filter?: unknown) => PerformanceBenchmark[];
}

export class PerformanceMonitorHandlers {
  constructor(params: {
    alertManager: AlertManager;
    metricsTracker: MetricsTracker;
    benchmarkManager: BenchmarkManager;
    config: PerformanceMonitorConfig;
    emit: (event: string, data: unknown) => void;
  }) {
    this.alertManager = params.alertManager;
    this.metricsTracker = params.metricsTracker;
    this.benchmarkManager = params.benchmarkManager;
    this.config = params.config;
    this.emit = params.emit;
  }

  private alertManager: AlertManager;
  private metricsTracker: MetricsTracker;
  private benchmarkManager: BenchmarkManager;
  private config: PerformanceMonitorConfig;
  private emit: (event: string, data: unknown) => void;

  public handleRecordMetricValue(
    name: string,
    value: number,
    tags?: Record<string, string>,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.config.enableMetrics) return;

    const metric: PerformanceMetric = {
      id: `metric-${Date.now()}`,
      name,
      value,
      timestamp: Date.now(),
      tags,
      metadata,
    };
    this.metricsTracker.recordMetric(metric);

    const alert = this.alertManager.checkMetric(metric);
    if (alert != null) this.emit('alert', alert);
  }

  public handleAddThreshold(threshold: {
    metricName?: string;
    metric?: string;
    warningValue: number;
    criticalValue: number;
    direction: 'above' | 'below';
  }): void {
    if (!this.config.enableAlerts) return;
    const normalizedThreshold = {
      metric: threshold.metric ?? threshold.metricName ?? '',
      warningValue: threshold.warningValue,
      criticalValue: threshold.criticalValue,
      direction: threshold.direction,
    };
    this.alertManager.addThreshold(normalizedThreshold);
  }

  public handleRemoveThreshold(metricName: string): boolean {
    if (!this.config.enableAlerts) return false;
    return this.alertManager.removeThreshold(metricName);
  }

  public handleGetAlerts(level?: string): unknown[] {
    if (!this.config.enableAlerts) return [];
    return this.alertManager.getAlerts(level);
  }

  public startAutoSampling(): void {
    if (!this.config.enableAutoSampling) return;
    this.metricsTracker.startAutoSampling();
  }

  public stopAutoSampling(): void {
    this.metricsTracker.stopAutoSampling();
  }
}
