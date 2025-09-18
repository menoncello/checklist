import { MemoryTracker } from './MemoryTracker';
import { MetricsCollector } from './MetricsCollector';
import { PerformanceMonitor } from './PerformanceMonitor';
import { StartupProfiler } from './StartupProfiler';

export interface PerformanceManagerConfig {
  enableMonitoring: boolean;
  enableMemoryTracking: boolean;
  enableMetricsCollection: boolean;
  alertsEnabled: boolean;
  reportingInterval: number;
  maxDataPoints: number;
  startupProfiling: boolean;
}

export class PerformanceManagerBase {
  protected monitor!: PerformanceMonitor;
  protected startupProfiler!: StartupProfiler;
  protected memoryTracker!: MemoryTracker;
  protected metricsCollector!: MetricsCollector;
  protected config: PerformanceManagerConfig;

  constructor(config: Partial<PerformanceManagerConfig> = {}) {
    this.config = this.initializeConfig(config);
    this.initializeComponents();
  }

  private initializeConfig(
    config: Partial<PerformanceManagerConfig>
  ): PerformanceManagerConfig {
    return {
      enableMonitoring: true,
      enableMemoryTracking: true,
      enableMetricsCollection: true,
      alertsEnabled: true,
      reportingInterval: 60000, // 1 minute
      maxDataPoints: 1000,
      startupProfiling: true,
      ...config,
    };
  }

  private initializeComponents(): void {
    this.monitor = new PerformanceMonitor({
      enableMetrics: this.config.enableMonitoring,
      enableAlerts: this.config.alertsEnabled,
    });

    this.startupProfiler = new StartupProfiler({
      enableProfiling: true,
    });

    this.memoryTracker = new MemoryTracker({
      enableTracking: this.config.enableMemoryTracking,
      historySize: this.config.maxDataPoints,
    });

    this.metricsCollector = new MetricsCollector({
      enableCollection: this.config.enableMetricsCollection,
      enableAlerting: this.config.alertsEnabled,
    });
  }

  public start(): void {
    // Start monitoring components
    this.memoryTracker.start();
    this.metricsCollector.start();

    if (this.config.startupProfiling && !this.startupProfiler.isCompleted()) {
      this.startupProfiler.startPhase('initialization');
    }
  }

  public stop(): void {
    // Stop monitoring components
    this.memoryTracker.stop();
    this.metricsCollector.stop();
  }

  public reset(): void {
    // Reset monitoring components
    this.memoryTracker.clearHistory();
    this.metricsCollector.clear();
  }

  // Simple getters
  public getMemorySnapshot(): unknown {
    return this.memoryTracker.getCurrentSnapshot();
  }
  public triggerGC(): boolean {
    return this.memoryTracker.triggerGC();
  }
  public getSystemSnapshot(): unknown {
    return this.monitor.getSystemSnapshot();
  }
  public queryMetrics(query: Record<string, unknown>): unknown {
    return this.metricsCollector.query(query);
  }
  public getConfig(): PerformanceManagerConfig {
    return { ...this.config };
  }
  public getStartupProfile(): unknown {
    return this.startupProfiler.isCompleted()
      ? this.startupProfiler.generateReport()
      : null;
  }
  public getMemoryStatistics(): unknown {
    return this.memoryTracker.getStatistics();
  }
  public getMetricsReport(): unknown {
    return this.metricsCollector.generateReport();
  }
  public recordMetric(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void {
    this.metricsCollector.record(name, value, tags);
  }
  public markStartupPhaseComplete(phaseName: string): void {
    if (!this.startupProfiler.isCompleted())
      this.startupProfiler.endPhase(phaseName);
  }

  public updateConfig(cfg: Partial<PerformanceManagerConfig>): void {
    this.config = { ...this.config, ...cfg };
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
  }
}
