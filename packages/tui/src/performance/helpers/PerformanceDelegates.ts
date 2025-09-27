import type {
  AlertManager,
  PerformanceAlert,
  PerformanceThreshold,
} from './AlertManager';
import type {
  BenchmarkManager,
  PerformanceBenchmark,
  BenchmarkFilter,
} from './BenchmarkManager';
import type {
  MetricsTracker,
  PerformanceMetric,
  MetricFilter,
} from './MetricsTracker';
import type { SystemProfiler, SystemSnapshot } from './SystemProfiler';

export class MetricsDelegates {
  constructor(private metricsTracker: MetricsTracker) {}

  mark(name: string): number {
    return this.metricsTracker.mark(name);
  }

  measure(name: string, startMark: string, endMark: string): number {
    return this.metricsTracker.measure(name, startMark, endMark);
  }

  recordMetricValue(
    name: string,
    value: number,
    tags?: Record<string, string>,
    metadata?: Record<string, unknown>
  ): void {
    this.metricsTracker.recordMetricValue(name, value, tags, metadata);
  }

  recordMetric(metric: PerformanceMetric): void {
    this.metricsTracker.recordMetric(metric);
  }

  getMetrics(filter?: MetricFilter): PerformanceMetric[] {
    return this.metricsTracker.getMetrics(filter);
  }

  getStatistics(metricName: string): {
    count: number;
    min: number;
    max: number;
    average: number;
    median: number;
    p95: number;
  } {
    return this.metricsTracker.getStatistics(metricName);
  }

  clearMetrics(): void {
    this.metricsTracker.clear();
  }
}

export class BenchmarkDelegates {
  constructor(private benchmarkManager: BenchmarkManager) {}

  startBenchmark(
    name: string,
    category: string = 'general',
    metadata?: Record<string, unknown>
  ): string {
    return this.benchmarkManager.startBenchmark(name, category, metadata);
  }

  endBenchmark(id: string): PerformanceBenchmark | null {
    return this.benchmarkManager.endBenchmark(id);
  }

  measureFunction<T extends (...args: unknown[]) => unknown>(
    fn: T,
    name: string,
    category: string = 'function'
  ): T {
    return this.benchmarkManager.measureFunction(fn, name, category);
  }

  async measureAsync<T>(
    promise: Promise<T>,
    name: string,
    category: string = 'async'
  ): Promise<T> {
    return this.benchmarkManager.measureAsync(promise, name, category);
  }

  getBenchmarks(filter?: BenchmarkFilter): PerformanceBenchmark[] {
    return this.benchmarkManager.getBenchmarks(filter);
  }

  clearBenchmarks(): void {
    this.benchmarkManager.clear();
  }
}

export class AlertDelegates {
  constructor(private alertManager: AlertManager) {}

  addThreshold(threshold: PerformanceThreshold): void {
    this.alertManager.addThreshold(threshold);
  }

  removeThreshold(metric: string): boolean {
    return this.alertManager.removeThreshold(metric);
  }

  getAlerts(level?: 'warning' | 'critical'): PerformanceAlert[] {
    return this.alertManager.getAlerts(level);
  }

  clearAlerts(): void {
    this.alertManager.clear();
  }
}

export class SystemDelegates {
  constructor(private systemProfiler: SystemProfiler) {}

  getSystemSnapshot(): SystemSnapshot {
    return this.systemProfiler.getSystemSnapshot();
  }
}
