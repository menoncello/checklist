import {
  PerformanceMonitor as PerformanceMonitorCore,
  type PerformanceMonitorConfig,
} from './PerformanceMonitorSlim';
import type {
  PerformanceMetric,
  PerformanceThreshold,
  PerformanceAlert,
  PerformanceBenchmark,
  MetricFilter,
  BenchmarkFilter,
  SystemSnapshot,
} from './types';

export type {
  PerformanceMonitorConfig,
  PerformanceMetric,
  PerformanceThreshold,
  PerformanceAlert,
  PerformanceBenchmark,
  MetricFilter,
  BenchmarkFilter,
  SystemSnapshot,
};

// Re-export all methods from the core class
export class PerformanceMonitor extends PerformanceMonitorCore {
  constructor(config?: Partial<PerformanceMonitorConfig>) {
    super(config);
  }

  // Ensure all methods are properly exposed by explicitly defining them
  public recordMetricValue = (
    name: string,
    value: number,
    tags?: Record<string, string>,
    metadata?: Record<string, unknown>
  ): void => super.recordMetricValue(name, value, tags, metadata);

  public destroy = (): void => super.destroy();

  public getConfig = (): PerformanceMonitorConfig => super.getConfig();

  public getMetrics = (filter?: MetricFilter) => super.getMetrics(filter);

  public getBenchmarks = (filter?: BenchmarkFilter) =>
    super.getBenchmarks(filter);

  public getAlerts = (level?: string) => super.getAlerts(level);

  public startBenchmark = (
    name: string,
    category?: string,
    metadata?: Record<string, unknown>
  ): string => super.startBenchmark(name, category, metadata);

  public endBenchmark = (id: string): PerformanceBenchmark | null =>
    super.endBenchmark(id);

  public mark = (name: string): number => super.mark(name);

  public measure = (name: string, start: string, end: string): number =>
    super.measure(name, start, end);

  public recordMetric = (metric: PerformanceMetric): void =>
    super.recordMetric(metric);

  public getStatistics = (metricName: string) =>
    super.getStatistics(metricName);

  public getSystemSnapshot = (): SystemSnapshot => super.getSystemSnapshot();

  public on = (event: string, handler: (...args: unknown[]) => void): void =>
    super.on(event, handler);

  public off = (event: string, handler: (...args: unknown[]) => void): void =>
    super.off(event, handler);

  public emit = (event: string, data: unknown): void => super.emit(event, data);

  public addThreshold = (threshold: PerformanceThreshold): void =>
    super.addThreshold(threshold);

  public removeThreshold = (metricName: string): boolean =>
    super.removeThreshold(metricName);

  public clearMetrics = (): void => super.clearMetrics();

  public clearBenchmarks = (): void => super.clearBenchmarks();

  public clearAlerts = (): void => super.clearAlerts();

  public clearAll = (): void => super.clearAll();

  public updateConfig = (newConfig: Partial<PerformanceMonitorConfig>): void =>
    super.updateConfig(newConfig);

  public getReport = () => super.getReport();

  public generateReport = () => super.generateReport();

  public handleSystemMetric = (
    name: string,
    value: number,
    metadata?: Record<string, unknown>
  ): void => super.handleSystemMetric(name, value, metadata);

  public addAlert = (alert: PerformanceAlert): void => super.addAlert(alert);

  public getUptime = (): number => super.getUptime();

  public recordCommandExecution = (commandId: string, duration: number): void =>
    super.recordCommandExecution(commandId, duration);

  public measureFunction = <T extends (...args: unknown[]) => unknown>(
    fn: T,
    name?: string,
    category?: string
  ): T => super.measureFunction(fn, name, category);

  public measureAsync = async <T>(
    promise: Promise<T>,
    name: string,
    category?: string
  ): Promise<T> => super.measureAsync(promise, name, category);
}
