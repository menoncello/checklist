import { AlertManager, PerformanceAlert, PerformanceThreshold } from './helpers/AlertManager.js';
import { BenchmarkManager, PerformanceBenchmark, BenchmarkFilter } from './helpers/BenchmarkManager.js';
import { MetricsTracker, PerformanceMetric, MetricFilter } from './helpers/MetricsTracker.js';
import { SystemProfiler, SystemSnapshot } from './helpers/SystemProfiler.js';

export { PerformanceMetric, PerformanceBenchmark, PerformanceAlert, PerformanceThreshold };
export { MetricFilter, BenchmarkFilter, SystemSnapshot };

export interface PerformanceMonitorConfig {
  enableMetrics: boolean;
  enableBenchmarks: boolean;
  enableAlerts: boolean;
  metricsBufferSize: number;
  benchmarksBufferSize: number;
  alertsBufferSize: number;
  samplingInterval: number;
  enableAutoSampling: boolean;
  enableMemoryProfiling: boolean;
  enableCPUProfiling: boolean;
}

export class PerformanceMonitor {
  private config: PerformanceMonitorConfig;
  private metricsTracker: MetricsTracker;
  private benchmarkManager: BenchmarkManager;
  private alertManager: AlertManager;
  private systemProfiler: SystemProfiler;
  private eventHandlers = new Map<string, Set<Function>>();
  private startTime = performance.now();

  constructor(config: Partial<PerformanceMonitorConfig> = {}) {
    this.config = {
      enableMetrics: true,
      enableBenchmarks: true,
      enableAlerts: true,
      metricsBufferSize: 1000,
      benchmarksBufferSize: 500,
      alertsBufferSize: 100,
      samplingInterval: 5000,
      enableAutoSampling: true,
      enableMemoryProfiling: true,
      enableCPUProfiling: false,
      ...config,
    };

    this.metricsTracker = new MetricsTracker(this.config.metricsBufferSize);
    this.benchmarkManager = new BenchmarkManager(this.config.benchmarksBufferSize);
    this.alertManager = new AlertManager(this.config.alertsBufferSize);
    this.systemProfiler = new SystemProfiler(
      this.config.samplingInterval,
      (name, value, metadata) => this.handleSystemMetric(name, value, metadata)
    );

    if (this.config.enableAutoSampling) {
      this.systemProfiler.start();
    }
  }

  private handleSystemMetric(name: string, value: number, metadata?: Record<string, unknown>): void {
    if (!this.config.enableMetrics) return;

    const metric: PerformanceMetric = {
      id: `system-${Date.now()}-${Math.random()}`,
      name,
      value,
      timestamp: Date.now(),
      metadata
    };

    this.metricsTracker.recordMetric(metric);

    if (this.config.enableAlerts) {
      const alert = this.alertManager.checkMetric(metric);
      if (alert != null) {
        this.emit('alert', alert);
      }
    }
  }

  // Delegation methods to maintain API compatibility
  public mark(name: string): number {
    return this.metricsTracker.mark(name);
  }

  public measure(name: string, startMark: string, endMark: string): number {
    return this.metricsTracker.measure(name, startMark, endMark);
  }

  public recordMetricValue(
    name: string,
    value: number,
    tags?: Record<string, string>,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.config.enableMetrics) return;
    this.metricsTracker.recordMetricValue(name, value, tags, metadata);
  }

  public recordMetric(metric: PerformanceMetric): void {
    if (!this.config.enableMetrics) return;
    this.metricsTracker.recordMetric(metric);

    if (this.config.enableAlerts) {
      const alert = this.alertManager.checkMetric(metric);
      if (alert != null) {
        this.emit('alert', alert);
      }
    }
  }

  public startBenchmark(
    name: string,
    category: string = 'general',
    metadata?: Record<string, unknown>
  ): string {
    if (!this.config.enableBenchmarks) return '';
    return this.benchmarkManager.startBenchmark(name, category, metadata);
  }

  public endBenchmark(id: string): PerformanceBenchmark | null {
    if (!this.config.enableBenchmarks) return null;
    return this.benchmarkManager.endBenchmark(id);
  }

  public measureFunction<T extends (...args: unknown[]) => unknown>(
    fn: T,
    name: string,
    category: string = 'function'
  ): T {
    if (!this.config.enableBenchmarks) return fn;
    return this.benchmarkManager.measureFunction(fn, name, category);
  }

  public async measureAsync<T>(
    promise: Promise<T>,
    name: string,
    category: string = 'async'
  ): Promise<T> {
    if (!this.config.enableBenchmarks) return promise;
    return this.benchmarkManager.measureAsync(promise, name, category);
  }

  public generateReport(): {
    metrics: PerformanceMetric[];
    benchmarks: PerformanceBenchmark[];
    alerts: PerformanceAlert[];
    systemSnapshot: SystemSnapshot;
  } {
    return {
      metrics: this.metricsTracker.getMetrics(),
      benchmarks: this.benchmarkManager.getBenchmarks(),
      alerts: this.alertManager.getAlerts(),
      systemSnapshot: this.systemProfiler.getSystemSnapshot()
    };
  }

  public addThreshold(threshold: PerformanceThreshold): void {
    this.alertManager.addThreshold(threshold);
  }

  public removeThreshold(metric: string): boolean {
    return this.alertManager.removeThreshold(metric);
  }

  public getMetrics(filter?: MetricFilter): PerformanceMetric[] {
    return this.metricsTracker.getMetrics(filter);
  }

  public getBenchmarks(filter?: BenchmarkFilter): PerformanceBenchmark[] {
    return this.benchmarkManager.getBenchmarks(filter);
  }

  public getAlerts(level?: 'warning' | 'critical'): PerformanceAlert[] {
    return this.alertManager.getAlerts(level);
  }

  public getStatistics(metricName: string): {
    count: number;
    min: number;
    max: number;
    average: number;
    median: number;
    p95: number;
  } {
    return this.metricsTracker.getStatistics(metricName);
  }

  public getSystemSnapshot(): SystemSnapshot {
    return this.systemProfiler.getSystemSnapshot();
  }

  public clearMetrics(): void {
    this.metricsTracker.clear();
  }

  public clearBenchmarks(): void {
    this.benchmarkManager.clear();
  }

  public clearAlerts(): void {
    this.alertManager.clear();
  }

  public clearAll(): void {
    this.clearMetrics();
    this.clearBenchmarks();
    this.clearAlerts();
  }

  public updateConfig(newConfig: Partial<PerformanceMonitorConfig>): void {
    const wasAutoSampling = this.config.enableAutoSampling;
    this.config = { ...this.config, ...newConfig };

    if (wasAutoSampling !== this.config.enableAutoSampling) {
      if (this.config.enableAutoSampling) {
        this.systemProfiler.start();
      } else {
        this.systemProfiler.stop();
      }
    }

    this.emit('configUpdated', this.config);
  }

  public getConfig(): PerformanceMonitorConfig {
    return { ...this.config };
  }

  public destroy(): void {
    this.systemProfiler.stop();
    this.clearAll();
    this.eventHandlers.clear();
    this.emit('destroyed');
  }

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in performance monitor event handler for '${event}':`, error);
        }
      });
    }
  }
}