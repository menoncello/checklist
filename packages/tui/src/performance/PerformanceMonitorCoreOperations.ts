import type {
  PerformanceMetric,
  PerformanceBenchmark,
  PerformanceAlert,
  SystemSnapshot,
} from './types';

export class PerformanceMonitorCoreOperations {
  constructor(private core: Record<string, Function>) {}

  public getMetrics(filter?: unknown): PerformanceMetric[] {
    return this.core.getMetrics(filter);
  }

  public getBenchmarks(filter?: unknown): PerformanceBenchmark[] {
    return this.core.getBenchmarks(filter);
  }

  public getAlerts(level?: string): PerformanceAlert[] {
    return this.core.getAlerts(level);
  }

  public mark(name: string): number {
    return this.core.mark(name);
  }

  public measure(name: string, start: string, end: string): number {
    return this.core.measure(name, start, end);
  }

  public recordMetricValue(
    name: string,
    value: number,
    tags?: Record<string, string>,
    metadata?: Record<string, unknown>
  ): void {
    this.core.recordMetricValue(name, value, tags, metadata);
  }

  public getStatistics(metricName: string): unknown {
    return this.core.getStatistics(metricName);
  }

  public getSystemSnapshot(): SystemSnapshot {
    return this.core.getSystemSnapshot();
  }

  public addThreshold(threshold: {
    metricName?: string;
    metric?: string;
    warningValue: number;
    criticalValue: number;
    direction: 'above' | 'below';
  }): void {
    this.core.addThreshold(threshold);
  }

  public removeThreshold(metricName: string): boolean {
    return this.core.removeThreshold(metricName);
  }
}
