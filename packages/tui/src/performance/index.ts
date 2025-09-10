export { PerformanceMonitor } from './PerformanceMonitor';
export { StartupProfiler } from './StartupProfiler';
export { MemoryTracker } from './MemoryTracker';
export { MetricsCollector } from './MetricsCollector';

export type {
  PerformanceMetric,
  PerformanceThreshold,
  PerformanceBenchmark,
  PerformanceAlert,
  PerformanceMonitorConfig,
  MetricFilter,
  BenchmarkFilter,
  MetricStatistics,
  SystemSnapshot,
} from './PerformanceMonitor';

export type {
  StartupPhase,
  StartupMilestone,
  StartupProfilerConfig,
  StartupProfile,
  TargetAnalysis,
  PhaseOptions,
  PhaseStatistics,
  BottleneckInfo,
  StartupReport,
} from './StartupProfiler';

export type {
  MemorySnapshot,
  MemoryLeak,
  MemoryTrackerConfig,
  MemoryTrend,
  MemoryStatistics,
} from './MemoryTracker';

export type {
  MetricPoint,
  MetricSeries,
  MetricQuery,
  MetricsReport,
  MetricAlert,
  MetricsCollectorConfig,
  AlertRule,
  CollectorMetrics,
} from './MetricsCollector';

import { MemoryTracker } from './MemoryTracker';
import { MetricsCollector } from './MetricsCollector';
import { PerformanceMonitor } from './PerformanceMonitor';
import { StartupProfiler } from './StartupProfiler';

export interface PerformanceManagerConfig {
  enableMonitoring: boolean;
  enableStartupProfiling: boolean;
  enableMemoryTracking: boolean;
  enableMetricsCollection: boolean;
  reportingInterval: number;
  alertsEnabled: boolean;
}

export class PerformanceManager {
  private config: PerformanceManagerConfig;
  private monitor: PerformanceMonitor;
  private startupProfiler: StartupProfiler;
  private memoryTracker: MemoryTracker;
  private metricsCollector: MetricsCollector;
  private reportingTimer: Timer | null = null;
  private eventHandlers = new Map<string, Set<Function>>();

  constructor(config: Partial<PerformanceManagerConfig> = {}) {
    this.config = {
      enableMonitoring: true,
      enableStartupProfiling: true,
      enableMemoryTracking: true,
      enableMetricsCollection: true,
      reportingInterval: 60000, // 1 minute
      alertsEnabled: true,
      ...config,
    };

    // Initialize components
    this.monitor = new PerformanceMonitor({
      enableMetrics: this.config.enableMonitoring,
      enableAlerts: this.config.alertsEnabled,
    });

    this.startupProfiler = new StartupProfiler({
      enableProfiling: this.config.enableStartupProfiling,
    });

    this.memoryTracker = new MemoryTracker({
      enableTracking: this.config.enableMemoryTracking,
    });

    this.metricsCollector = new MetricsCollector({
      enableCollection: this.config.enableMetricsCollection,
      enableAlerts: this.config.alertsEnabled,
    });

    this.setupEventHandlers();
    this.startReporting();
  }

  private setupEventHandlers(): void {
    // Forward monitor events
    this.monitor.on('metricRecorded', (data: unknown) => {
      const metricData = data as {
        metric: {
          name: string;
          value: number;
          tags?: Record<string, string>;
          metadata?: unknown;
        };
      };
      this.metricsCollector.collect(
        metricData.metric.name,
        metricData.metric.value,
        metricData.metric.tags,
        metricData.metric.metadata as Record<string, unknown> | undefined
      );
      this.emit('metricRecorded', data);
    });

    this.monitor.on('performanceAlert', (data: unknown) => {
      this.emit('performanceAlert', data);
    });

    // Forward startup profiler events
    this.startupProfiler.on('phaseStarted', (data: unknown) => {
      this.emit('startupPhaseStarted', data);
    });

    this.startupProfiler.on('phaseEnded', (data: unknown) => {
      this.emit('startupPhaseEnded', data);
      // Collect phase metrics
      const phaseData = data as { phase: { name: string; duration?: number } };
      if (phaseData.phase.duration != null && phaseData.phase.duration !== 0) {
        this.metricsCollector.collect(
          `startup_phase_${phaseData.phase.name}`,
          phaseData.phase.duration,
          { phase: phaseData.phase.name, category: 'startup' }
        );
      }
    });

    this.startupProfiler.on('startupComplete', (data: unknown) => {
      this.emit('startupComplete', data);
      // Collect overall startup metrics
      const startupData = data as { profile: { totalDuration?: number } };
      if (
        startupData.profile.totalDuration != null &&
        startupData.profile.totalDuration !== 0
      ) {
        this.metricsCollector.collect(
          'startup_total_time',
          startupData.profile.totalDuration,
          { category: 'startup' }
        );
      }
    });

    // Forward memory tracker events
    this.memoryTracker.on('memoryAlert', (data: unknown) => {
      this.emit('memoryAlert', data);
    });

    this.memoryTracker.on('memoryLeak', (data: unknown) => {
      this.emit('memoryLeak', data);
    });

    this.memoryTracker.on('memorySnapshot', (data: unknown) => {
      // Collect memory metrics
      const snapshotData = data as {
        snapshot: { rss: number; heapUsed: number; heapTotal: number };
      };
      const snapshot = snapshotData.snapshot;
      this.metricsCollector.collect('memory_rss', snapshot.rss, {
        type: 'system',
      });
      this.metricsCollector.collect('memory_heap_used', snapshot.heapUsed, {
        type: 'system',
      });
      this.metricsCollector.collect('memory_heap_total', snapshot.heapTotal, {
        type: 'system',
      });
    });

    // Forward metrics collector events
    this.metricsCollector.on('alertTriggered', (data: unknown) => {
      this.emit('metricsAlert', data);
    });
  }

  private startReporting(): void {
    if (this.config.reportingInterval > 0) {
      this.reportingTimer = setInterval(() => {
        this.generatePerformanceReport();
      }, this.config.reportingInterval);
    }
  }

  public generatePerformanceReport(): PerformanceReport {
    const timestamp = Date.now();

    // Get data from all components
    const monitorSnapshot = this.monitor.getSystemSnapshot();
    const memoryStats = this.memoryTracker.getStatistics();
    const metricsReport = this.metricsCollector.generateReport();
    const startupProfile = this.startupProfiler.isCompleted()
      ? this.startupProfiler.generateReport()
      : null;

    // Combine into comprehensive report
    const report: PerformanceReport = {
      timestamp,
      uptime: monitorSnapshot.uptime,
      system: {
        memory: monitorSnapshot.memory,
        cpu: monitorSnapshot.cpu,
        eventLoopDelay: 0, // Will be populated from metrics
      },
      startup: startupProfile,
      memory: {
        current: memoryStats.current,
        trends: memoryStats.trends,
        leaks: this.memoryTracker.getLeaks(),
      },
      metrics: {
        totalSeries: metricsReport.summary.uniqueSeries,
        totalPoints: metricsReport.summary.totalPoints,
        sampleRate: metricsReport.summary.sampleRate,
      },
      alerts: {
        performance: this.monitor.getAlerts(),
        memory: this.memoryTracker.getLeaks().map((leak) => ({
          type: 'memory_leak',
          severity: 'critical' as const,
          message: `Memory leak detected: ${leak.type}`,
          timestamp: leak.timestamp,
          data: leak,
        })),
        metrics: this.metricsCollector.getAlerts(),
      },
      recommendations: this.generateRecommendations(metricsReport),
    };

    this.emit('performanceReport', { report });
    return report;
  }

  private generateRecommendations(metricsReport: {
    recommendations: string[];
  }): string[] {
    const recommendations: string[] = [];

    // Add metrics collector recommendations
    recommendations.push(...metricsReport.recommendations);

    // Add memory recommendations
    const memoryStats = this.memoryTracker.getStatistics();
    if (
      memoryStats.trends.some(
        (t) => t.direction === 'increasing' && t.rate > 1024 * 1024
      )
    ) {
      recommendations.push(
        'Memory usage is increasing rapidly - investigate potential memory leaks'
      );
    }

    // Add startup recommendations
    if (this.startupProfiler.isCompleted()) {
      const startupReport = this.startupProfiler.generateReport();
      if (!startupReport.profile.meetsTargets) {
        recommendations.push(
          'Startup performance targets not met - consider optimizing initialization'
        );
      }
    }

    return recommendations;
  }

  // Public API methods
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
    this.monitor.startBenchmark(id, name, category);
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

    // Update component configs
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

    // Restart reporting if interval changed
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
    this.eventHandlers.clear();
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
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(
            `Error in performance manager event handler for '${event}':`,
            error
          );
        }
      });
    }
  }
}

export interface PerformanceReport {
  timestamp: number;
  uptime: number;
  system: {
    memory: NodeJS.MemoryUsage;
    cpu: {
      user: number;
      system: number;
    };
    eventLoopDelay: number;
  };
  startup: unknown | null;
  memory: {
    current: NodeJS.MemoryUsage;
    trends: unknown[];
    leaks: unknown[];
  };
  metrics: {
    totalSeries: number;
    totalPoints: number;
    sampleRate: number;
  };
  alerts: {
    performance: unknown[];
    memory: Array<{
      type: string;
      severity: string;
      message: string;
      timestamp: number;
      data: unknown;
    }>;
    metrics: unknown[];
  };
  recommendations: string[];
}
