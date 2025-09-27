import type { PerformanceMonitorConfig } from './PerformanceMonitorConfig';
import type {
  PerformanceAlert,
  PerformanceThreshold,
} from './helpers/AlertManager';
import type {
  PerformanceBenchmark,
  BenchmarkFilter,
} from './helpers/BenchmarkManager';
import type { PerformanceMetric, MetricFilter } from './helpers/MetricsTracker';
import type { PerformanceMonitorComponents } from './helpers/PerformanceMonitorFactory';
import type { PerformanceReport } from './helpers/ReportGenerator';
import type { SystemSnapshot } from './helpers/SystemProfiler';

export class PerformanceMonitorDelegations {
  constructor(
    public readonly components: PerformanceMonitorComponents,
    private config: PerformanceMonitorConfig
  ) {}

  public mark(name: string): number {
    return this.components.metricsTracker.mark(name);
  }

  public measure(name: string, startMark: string, endMark: string): number {
    return this.components.metricsTracker.measure(name, startMark, endMark);
  }

  public recordMetricValue(
    name: string,
    value: number,
    tags?: Record<string, string>,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.config.enableMetrics) return;
    this.components.metricsTracker.recordMetricValue(
      name,
      value,
      tags,
      metadata
    );
  }

  public startBenchmark(
    name: string,
    category: string = 'general',
    metadata?: Record<string, unknown>
  ): string {
    if (this.config.enableBenchmarks !== true) return '';
    return this.components.benchmarkManager.startBenchmark(
      name,
      category,
      metadata
    );
  }

  public endBenchmark(id: string): PerformanceBenchmark | null {
    if (this.config.enableBenchmarks !== true) return null;
    return this.components.benchmarkManager.endBenchmark(id);
  }

  public measureFunction<T extends (...args: unknown[]) => unknown>(
    fn: T,
    name: string,
    category: string = 'function'
  ): T {
    if (this.config.enableBenchmarks !== true) return fn;
    return this.components.benchmarkManager.measureFunction(fn, name, category);
  }

  public async measureAsync<T>(
    promise: Promise<T>,
    name: string,
    category: string = 'async'
  ): Promise<T> {
    if (this.config.enableBenchmarks !== true) return promise;
    return this.components.benchmarkManager.measureAsync(
      promise,
      name,
      category
    );
  }

  public generateReport(): PerformanceReport {
    return this.components.reportGenerator.generateReport();
  }

  public addThreshold(threshold: PerformanceThreshold): void {
    this.components.alertManager.addThreshold(threshold);
  }

  public removeThreshold(metric: string): boolean {
    return this.components.alertManager.removeThreshold(metric);
  }

  private filterMetrics(
    metrics: PerformanceMetric[],
    filter: MetricFilter
  ): PerformanceMetric[] {
    let filtered = [...metrics];

    filtered = this.applyNameFilter(filtered, filter.name);
    filtered = this.applyTimeRangeFilter(
      filtered,
      filter.startTime,
      filter.endTime
    );
    filtered = this.applyTagsFilter(filtered, filter.tags);
    filtered = this.applyLimitFilter(filtered, filter.limit);

    return filtered;
  }

  private applyNameFilter(
    metrics: PerformanceMetric[],
    name?: string
  ): PerformanceMetric[] {
    return name != null ? metrics.filter((m) => m.name === name) : metrics;
  }

  private applyTimeRangeFilter(
    metrics: PerformanceMetric[],
    startTime?: number,
    endTime?: number
  ): PerformanceMetric[] {
    let filtered = metrics;

    if (startTime != null) {
      filtered = filtered.filter((m) => m.timestamp >= startTime);
    }

    if (endTime != null) {
      filtered = filtered.filter((m) => m.timestamp <= endTime);
    }

    return filtered;
  }

  private applyTagsFilter(
    metrics: PerformanceMetric[],
    tags?: Record<string, string>
  ): PerformanceMetric[] {
    if (tags == null) return metrics;

    return metrics.filter((m) => {
      if (m.tags == null) return false;
      return Object.entries(tags).every(
        ([key, value]) => m.tags?.[key] === value
      );
    });
  }

  private applyLimitFilter(
    metrics: PerformanceMetric[],
    limit?: number
  ): PerformanceMetric[] {
    return limit != null ? metrics.slice(-limit) : metrics;
  }

  public getMetrics(filter?: MetricFilter): PerformanceMetric[] {
    // Get metrics from both the tracker and buffer
    const trackerMetrics = this.components.metricsTracker.getMetrics();
    const bufferMetrics = this.components.metricsBuffer?.getMetrics() ?? [];
    let metrics = [...trackerMetrics, ...bufferMetrics];

    if (filter != null) {
      metrics = this.filterMetrics(metrics, filter);
    }

    return metrics;
  }

  public getBenchmarks(filter?: BenchmarkFilter): PerformanceBenchmark[] {
    return this.components.benchmarkManager.getBenchmarks(filter);
  }

  public getAlerts(level?: 'warning' | 'critical'): PerformanceAlert[] {
    return this.components.alertManager.getAlerts(level);
  }

  public getStatistics(metricName: string): {
    count: number;
    min: number;
    max: number;
    average: number;
    median: number;
    p95: number;
  } {
    return this.components.metricsTracker.getStatistics(metricName);
  }

  public getSystemSnapshot(): SystemSnapshot {
    return this.components.systemProfiler.getSystemSnapshot();
  }

  public clearMetrics(): void {
    this.components.metricsTracker.clear();
  }

  public clearBenchmarks(): void {
    this.components.benchmarkManager.clear();
  }

  public clearAlerts(): void {
    this.components.alertManager.clear();
  }

  public clearAll(): void {
    this.clearMetrics();
    this.clearBenchmarks();
    this.clearAlerts();
  }
}
