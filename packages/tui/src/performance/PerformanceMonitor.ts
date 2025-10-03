import { AlertManager } from './helpers/AlertManager';
import { BenchmarkManager } from './helpers/BenchmarkManager';
import { MetricsTracker } from './helpers/MetricsTracker';
import { SystemProfiler } from './helpers/SystemProfiler';
import type {
  PerformanceMetric,
  PerformanceBenchmark,
  PerformanceAlert,
  PerformanceThreshold,
  MetricFilter,
  BenchmarkFilter,
  SystemSnapshot,
} from './types';

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
  public metricsTracker: MetricsTracker;
  public benchmarkManager: BenchmarkManager;
  public alertManager: AlertManager;
  public systemProfiler: SystemProfiler;
  private eventHandlers = new Map<string, Set<Function>>();
  private startTime = performance.now();

  constructor(config?: Partial<PerformanceMonitorConfig>) {
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
    this.benchmarkManager = new BenchmarkManager(
      this.config.benchmarksBufferSize
    );
    this.alertManager = new AlertManager(this.config.alertsBufferSize);
    this.systemProfiler = new SystemProfiler(
      this.config.samplingInterval,
      (name, value, metadata) => this.handleSystemMetric(name, value, metadata)
    );

    if (this.config.enableAutoSampling) {
      this.systemProfiler.start();
    }
  }

  public handleSystemMetric(
    name: string,
    value: number,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.config.enableMetrics) return;

    const metric: PerformanceMetric = {
      id: `system-${Date.now()}-${Math.random()}`,
      name,
      value,
      timestamp: Date.now(),
      metadata,
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

    const metric: PerformanceMetric = {
      id: `metric-${Date.now()}-${Math.random()}`,
      name,
      value,
      timestamp: Date.now(),
      tags,
      metadata,
    };

    this.metricsTracker.recordMetric(metric);

    if (this.config.enableAlerts) {
      const alert = this.alertManager.checkMetric(metric);
      if (alert != null) {
        this.emit('alert', alert);
      }
    }
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

    const benchmark = this.benchmarkManager.endBenchmark(id);
    if (benchmark != null && this.config.enableAlerts) {
      // Check for performance thresholds
      const threshold: PerformanceThreshold = {
        metric: 'benchmark.duration',
        operator: '>',
        value: 1000, // 1 second threshold
        level: 'warning',
      };

      const alert = this.alertManager.checkThreshold(
        threshold,
        benchmark.duration
      );
      if (alert != null) {
        this.emit('alert', alert);
      }
    }

    return benchmark;
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

  public recordCommandExecution(commandId: string, duration: number): void {
    this.recordMetricValue('command.execution', duration, {
      commandId,
    });
  }

  // Configuration methods
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

  // Alert management
  public addThreshold(threshold: PerformanceThreshold): void {
    this.alertManager.addThreshold(threshold);
  }

  public removeThreshold(metric: string): boolean {
    return this.alertManager.removeThreshold(metric);
  }

  public getAlerts(level?: 'warning' | 'critical'): PerformanceAlert[] {
    return this.alertManager.getAlerts(level);
  }

  // Data access
  public getMetrics(filter?: MetricFilter): PerformanceMetric[] {
    return this.metricsTracker.getMetrics(filter);
  }

  public getBenchmarks(filter?: BenchmarkFilter): PerformanceBenchmark[] {
    return this.benchmarkManager.getBenchmarks(filter);
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

  public destroy(): void {
    this.systemProfiler.stop();
    this.clearAll();

    // Emit destroyed event before clearing handlers
    this.emit('destroyed');

    // Clear all event handlers to prevent memory leaks
    this.eventHandlers.clear();
  }

  // Event management
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

  public emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  // Performance profiling methods
  public startProfiling(name: string): void {
    this.mark(`profile-${name}-start`);
  }

  public endProfiling(name: string): number {
    const startTime = this.metricsTracker
      .getMarks()
      .get(`profile-${name}-start`);
    if (startTime == null) {
      throw new Error(`No active profile found for: ${name}`);
    }
    const duration = performance.now() - startTime;
    this.recordMetricValue(`profile.${name}`, duration, undefined, {
      profile: name,
    });
    return duration;
  }

  public getPerformanceReport(): {
    uptime: number;
    metricsCount: number;
    benchmarksCount: number;
    alertsCount: number;
    memoryUsage: SystemSnapshot;
    averageProcessingTime?: number;
  } {
    const uptime = performance.now() - this.startTime;
    const metricsCount = this.metricsTracker.count();
    const benchmarksCount = this.benchmarkManager.count();
    const alertsCount = this.alertManager.getAlerts().length;
    const memoryUsage = this.systemProfiler.getSystemSnapshot();

    return {
      uptime,
      metricsCount,
      benchmarksCount,
      alertsCount,
      memoryUsage,
    };
  }
}
