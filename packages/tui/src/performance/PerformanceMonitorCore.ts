import { DataSanitizer } from './DataSanitizer';
import { MetricsBuffer } from './MetricsBuffer';
import { PerformanceMonitorAsync } from './PerformanceMonitorAsync';
import { PerformanceMonitorDelegations } from './PerformanceMonitorDelegations';
import { PerformanceMonitorHelpers } from './PerformanceMonitorHelpers';
import { PerformanceAlert, PerformanceThreshold } from './helpers/AlertManager';
import type {
  PerformanceBenchmark,
  BenchmarkFilter,
} from './helpers/BenchmarkManager';
import type { PerformanceMetric, MetricFilter } from './helpers/MetricsTracker';
import { PerformanceReport } from './helpers/ReportGenerator';
import { SystemSnapshot } from './helpers/SystemProfiler';

export interface PerformanceMonitorComponents {
  delegations: PerformanceMonitorDelegations;
  helpers: PerformanceMonitorHelpers;
  dataSanitizer: DataSanitizer;
  metricsBuffer: MetricsBuffer;
  asyncProcessor: PerformanceMonitorAsync;
}

export class PerformanceMonitorCore {
  constructor(private components: PerformanceMonitorComponents) {}

  public mark(name: string): number {
    return this.components.delegations.mark(name);
  }

  public measure(name: string, startMark: string, endMark: string): number {
    return this.components.delegations.measure(name, startMark, endMark);
  }

  public recordMetricValue(
    name: string,
    value: number,
    tags?: Record<string, string>,
    metadata?: Record<string, unknown>
  ): void {
    this.components.delegations.recordMetricValue(name, value, tags, metadata);
  }

  public recordMetric(metric: PerformanceMetric): void {
    if (!this.components.helpers.shouldCollectMetrics()) return;

    // Apply sampling
    if (!this.components.helpers.shouldSampleMetric(metric.name)) return;

    // Sanitize metric data
    this.components.dataSanitizer.sanitizeMetricData(metric);

    // Store in tracker
    this.components.delegations.components.metricsTracker.recordMetric(metric);

    // Store in buffer
    this.components.metricsBuffer.push(metric);

    // Process async if not critical
    if (this.components.helpers.isNonCriticalMetric(metric.name)) {
      this.components.asyncProcessor.processMetricAsync(metric);
    } else {
      this.components.helpers.processMetric(metric);
    }
  }

  public startBenchmark(
    name: string,
    category: string = 'general',
    metadata?: Record<string, unknown>
  ): string {
    return this.components.delegations.startBenchmark(name, category, metadata);
  }

  public endBenchmark(id: string): PerformanceBenchmark | null {
    return this.components.delegations.endBenchmark(id);
  }

  public measureFunction<T extends (...args: unknown[]) => unknown>(
    fn: T,
    name: string,
    category: string = 'function'
  ): T {
    return this.components.delegations.measureFunction(fn, name, category);
  }

  public async measureAsync<T>(
    promise: Promise<T>,
    name: string,
    category: string = 'async'
  ): Promise<T> {
    return this.components.delegations.measureAsync(promise, name, category);
  }

  public generateReport(): PerformanceReport {
    return this.components.delegations.generateReport();
  }

  public addThreshold(threshold: PerformanceThreshold): void {
    this.components.delegations.addThreshold(threshold);
  }

  public removeThreshold(metric: string): boolean {
    return this.components.delegations.removeThreshold(metric);
  }

  public getMetrics(filter?: MetricFilter): PerformanceMetric[] {
    return this.components.delegations.getMetrics(filter);
  }

  public getBenchmarks(filter?: BenchmarkFilter): PerformanceBenchmark[] {
    return this.components.delegations.getBenchmarks(filter);
  }

  public getAlerts(level?: 'warning' | 'critical'): PerformanceAlert[] {
    return this.components.delegations.getAlerts(level);
  }

  public getStatistics(metricName: string): {
    count: number;
    min: number;
    max: number;
    average: number;
    median: number;
    p95: number;
  } {
    return this.components.delegations.getStatistics(metricName);
  }

  public getSystemSnapshot(): SystemSnapshot {
    return this.components.delegations.getSystemSnapshot();
  }

  public clearMetrics(): void {
    this.components.delegations.clearMetrics();
  }

  public clearBenchmarks(): void {
    this.components.delegations.clearBenchmarks();
  }

  public clearAlerts(): void {
    this.components.delegations.clearAlerts();
  }

  public clearAll(): void {
    this.components.delegations.clearAll();
  }
}
