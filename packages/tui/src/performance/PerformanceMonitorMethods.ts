import type {
  PerformanceMetric,
  PerformanceBenchmark,
} from './PerformanceMonitor';
import type { PerformanceMonitorInternal } from './PerformanceMonitorTypes';

/**
 * Core measurement methods for PerformanceMonitor
 */
export class PerformanceMonitorMethods {
  constructor(private monitor: PerformanceMonitorInternal) {}

  public mark(name: string): number {
    return this.monitor.core.mark(name);
  }

  public measure(name: string, startMark: string, endMark: string): number {
    return this.monitor.core.measure(name, startMark, endMark);
  }

  public recordMetricValue(
    name: string,
    value: number,
    tags?: Record<string, string>,
    metadata?: Record<string, unknown>
  ): void {
    this.monitor.core.recordMetricValue(name, value, tags, metadata);
  }

  public recordMetric(metric: PerformanceMetric): void {
    this.monitor.core.recordMetric(metric);
  }

  public startBenchmark(
    name: string,
    category: string = 'general',
    metadata?: Record<string, unknown>
  ): string {
    return this.monitor.core.startBenchmark(name, category, metadata);
  }

  public endBenchmark(id: string): PerformanceBenchmark | null {
    return this.monitor.core.endBenchmark(id);
  }

  public measureFunction<T extends (...args: unknown[]) => unknown>(
    fn: T,
    name: string,
    category: string = 'function'
  ): T {
    return this.monitor.core.measureFunction(fn, name, category) as T;
  }

  public async measureAsync<T>(
    promise: Promise<T>,
    name: string,
    category: string = 'async'
  ): Promise<T> {
    return this.monitor.core.measureAsync(promise, name, category);
  }
}
