import { MemoryTracker } from './MemoryTracker';
import { MetricsCollector } from './MetricsCollector';
import { PerformanceEventManager } from './PerformanceEventManager';
import type {
  PerformanceManagerConfig,
  PerformanceReport,
} from './PerformanceManagerTypes';
import { PerformanceMonitor } from './PerformanceMonitor';
import { PerformanceReportBuilder } from './PerformanceReportBuilder';
import { StartupProfiler } from './StartupProfiler';

export class PerformanceManager {
  private config!: PerformanceManagerConfig;
  private monitor!: PerformanceMonitor;
  private startupProfiler!: StartupProfiler;
  private memoryTracker!: MemoryTracker;
  private metricsCollector!: MetricsCollector;
  private reportingTimer: Timer | null = null;
  private eventManager!: PerformanceEventManager;
  private reportBuilder!: PerformanceReportBuilder;

  constructor(config: Partial<PerformanceManagerConfig> = {}) {
    this.config = {
      enableMonitoring: true,
      startupProfiling: true,
      enableMemoryTracking: true,
      enableMetricsCollection: true,
      reportingInterval: 60000,
      alertsEnabled: true,
      ...config,
    };
    this.initializeComponents();
    this.initializeEventSystem();
    this.setupEventHandlers();
    this.startReporting();
  }

  private initializeComponents(): void {
    this.monitor = new PerformanceMonitor({
      enableMetrics: this.config.enableMonitoring,
      enableAlerts: this.config.alertsEnabled,
    });

    this.startupProfiler = new StartupProfiler({
      enableProfiling: this.config.startupProfiling,
    });

    this.memoryTracker = new MemoryTracker({
      enableTracking: this.config.enableMemoryTracking,
    });

    this.metricsCollector = new MetricsCollector({
      enableCollection: this.config.enableMetricsCollection,
      enableAlerts: this.config.alertsEnabled,
    });
  }

  private initializeEventSystem(): void {
    this.eventManager = new PerformanceEventManager();
    this.reportBuilder = new PerformanceReportBuilder();
  }

  private setupEventHandlers(): void {
    // Setup event handlers as needed
  }

  private startReporting(): void {
    if (
      this.config.reportingInterval !== undefined &&
      this.config.reportingInterval > 0
    ) {
      this.reportingTimer = setInterval(() => {
        this.generatePerformanceReport();
      }, this.config.reportingInterval);
    }
  }

  public generatePerformanceReport(): PerformanceReport {
    const report = this.reportBuilder.build();
    this.eventManager.emit('performanceReport', { report });
    return report;
  }

  public recordMetric(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void {
    this.monitor.recordMetric({
      id: `${name}-${Date.now()}`,
      name,
      value,
      timestamp: Date.now(),
      tags,
    });
  }

  public startBenchmark(id: string, name: string, category?: string): void {
    this.monitor.startBenchmark(id, category ?? 'general');
  }

  public endBenchmark(id: string): unknown {
    return this.monitor.endBenchmark(id);
  }

  public measureFunction<T extends (...args: unknown[]) => unknown>(
    fn: T,
    name: string,
    category?: string
  ): T {
    return this.monitor.measureFunction(fn, name, category);
  }

  public measureAsync<T>(
    promise: Promise<T>,
    name: string,
    category?: string
  ): Promise<T> {
    return this.monitor.measureAsync(promise, name, category);
  }

  public startStartupPhase(
    name: string,
    options?: Record<string, unknown>
  ): void {
    this.startupProfiler.startPhase(name, options);
  }

  public endStartupPhase(name: string): unknown {
    return this.startupProfiler.endPhase(name);
  }

  public addStartupMilestone(name: string, description?: string): void {
    this.startupProfiler.addMilestone(name, description);
  }

  public completeStartup(): unknown {
    return this.startupProfiler.completeStartup();
  }

  public getMemorySnapshot(): unknown {
    return this.memoryTracker.getCurrentSnapshot();
  }

  public triggerGC(): boolean {
    return this.memoryTracker.triggerGC();
  }

  public getSystemSnapshot(): unknown {
    return this.monitor.getSystemSnapshot();
  }

  public queryMetrics(query: unknown): unknown {
    return this.metricsCollector.query(query as Record<string, unknown>);
  }

  public getPerformanceReport(): PerformanceReport {
    return this.generatePerformanceReport();
  }

  public updateConfig(newConfig: Partial<PerformanceManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };

    this.monitor.updateConfig({
      enableMetrics: this.config.enableMonitoring,
      enableAlerts: this.config.alertsEnabled,
    });

    this.memoryTracker.updateConfig({
      enableTracking: this.config.enableMemoryTracking,
    });

    this.metricsCollector.updateConfig({
      enableCollection: this.config.enableMetricsCollection,
      enableAlerts: this.config.alertsEnabled,
    });

    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
      this.reportingTimer = null;
    }
    this.startReporting();
  }

  public getConfig(): PerformanceManagerConfig {
    return { ...this.config };
  }

  public destroy(): void {
    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
      this.reportingTimer = null;
    }

    this.monitor.destroy();
    if (
      'destroy' in this.startupProfiler &&
      typeof this.startupProfiler.destroy === 'function'
    ) {
      this.startupProfiler.destroy();
    }
    this.memoryTracker.destroy();
    this.metricsCollector.destroy();
    this.eventManager.removeAllListeners();
  }

  public on(event: string, handler: (...args: unknown[]) => void): void {
    this.eventManager.on(event, handler);
  }

  public off(event: string, handler: (...args: unknown[]) => void): void {
    this.eventManager.off(event, handler as (...args: unknown[]) => void);
  }
}
