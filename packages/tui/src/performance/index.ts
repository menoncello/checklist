export { PerformanceMonitor } from './PerformanceMonitor';
export { StartupProfiler } from './StartupProfiler';
export { MemoryTracker } from './MemoryTracker';
export { MetricsCollector } from './MetricsCollector';
export { DataSanitizer } from './DataSanitizer';
export { PerformanceCircuitBreaker } from './PerformanceCircuitBreaker';
export { CircularBuffer } from './CircularBuffer';
export { MetricsBuffer } from './MetricsBuffer';
export {
  profile,
  setPerformanceMonitor,
  getProfileStats,
  clearProfileResults,
} from './ProfileDecorator';
export {
  ChromeDevToolsIntegration,
  chromeDevTools,
} from './ChromeDevToolsIntegration';
export type { PerformanceReport } from './ReportBuilder';
export type { PerformanceManagerConfig } from './PerformanceManagerBase';
export type { PerformanceMonitorConfig } from './PerformanceMonitorConfig';
export { defaultPerformanceMonitorConfig } from './PerformanceMonitorConfig';

import { EventEmitter } from 'events';
import { PerformanceManagerBase } from './PerformanceManagerBase';
import { ReportBuilder, type PerformanceReport } from './ReportBuilder';

export type {
  PerformanceMetric,
  PerformanceThreshold,
  PerformanceBenchmark,
  PerformanceAlert,
  SystemSnapshot,
} from './types';

export type { StartupPhase, StartupReport } from './StartupProfiler';

export type {
  MemorySnapshot,
  MemoryTrend,
  MemoryLeak,
  MemoryStatistics,
} from './MemoryTracker';

export type {
  MetricPoint,
  MetricQuery,
  MetricsReport,
} from './MetricsCollector';

export class PerformanceManager extends PerformanceManagerBase {
  private reportingTimer: ReturnType<typeof setInterval> | null = null;
  private reportBuilder = new ReportBuilder();
  private eventEmitter = new EventEmitter();

  public generatePerformanceReport(): PerformanceReport {
    const data = this.collectReportData();
    const report = this.buildReport(data);
    this.eventEmitter.emit('performanceReport', { report });
    return report;
  }

  private collectReportData() {
    return {
      timestamp: Date.now(),
      monitor: this.monitor.getSystemSnapshot(),
      memory: this.memoryTracker.getStatistics(),
      metrics: this.metricsCollector.generateReport(),
      startup: this.startupProfiler.isCompleted()
        ? this.startupProfiler.generateReport()
        : null,
      leaks: this.memoryTracker.getLeaks(),
    };
  }

  private buildReport(
    data: ReturnType<typeof this.collectReportData>
  ): PerformanceReport {
    return {
      timestamp: data.timestamp,
      uptime: (data.monitor as { uptime: number }).uptime,
      system: this.reportBuilder.createSystemReport(data.monitor),
      startup: data.startup,
      memory: this.reportBuilder.createMemoryReport(data.memory, data.leaks),
      metrics: {
        totalSeries: (data.metrics as { summary: { uniqueSeries: number } })
          .summary.uniqueSeries,
        totalPoints: (data.metrics as { summary: { totalPoints: number } })
          .summary.totalPoints,
        sampleRate: (data.metrics as { summary: { sampleRate: number } })
          .summary.sampleRate,
      },
      alerts: this.reportBuilder.buildAlerts(data),
      recommendations: this.reportBuilder.generateRecommendations(
        data.metrics,
        this.memoryTracker,
        this.startupProfiler,
        this.monitor
      ),
    };
  }

  public startReporting(): void {
    if (!this.config.reportingInterval || this.reportingTimer) return;

    this.reportingTimer = setInterval(() => {
      const report = this.generatePerformanceReport();
      this.eventEmitter.emit('report', report);
    }, this.config.reportingInterval);
  }

  public stopReporting(): void {
    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
      this.reportingTimer = null;
    }
  }

  public getPerformanceReport(): PerformanceReport {
    return this.generatePerformanceReport();
  }

  public startBenchmark(
    name: string,
    category: string = 'general',
    metadata?: Record<string, unknown>
  ): string {
    return this.monitor.startBenchmark(name, category, metadata);
  }

  public endBenchmark(id: string): unknown {
    return this.monitor.endBenchmark(id);
  }

  public addPerformanceListener(
    event: string,
    handler: (data: unknown) => void
  ): void {
    this.eventEmitter.on(event, handler);
  }

  public removePerformanceListener(
    event: string,
    handler: (data: unknown) => void
  ): void {
    this.eventEmitter.off(event, handler);
  }

  public destroy(): void {
    this.dispose();
  }

  public dispose(): void {
    this.stopReporting();
    this.stop();
    this.monitor.destroy();
    this.eventEmitter.removeAllListeners();
  }
}
