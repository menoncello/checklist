export { PerformanceMonitor } from './PerformanceMonitor';
export { StartupProfiler } from './StartupProfiler';
export { MemoryTracker } from './MemoryTracker';
export { MetricsCollector } from './MetricsCollector';
export type { PerformanceReport } from './ReportBuilder';
export type { PerformanceManagerConfig } from './PerformanceManagerBase';

import { EventEmitter } from 'events';
import { PerformanceManagerBase } from './PerformanceManagerBase';
import { ReportBuilder, type PerformanceReport } from './ReportBuilder';

export type {
  PerformanceMetric,
  PerformanceThreshold,
  PerformanceBenchmark,
  PerformanceAlert,
} from './PerformanceMonitor';

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
  private reportingTimer: Timer | null = null;
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

  public dispose(): void {
    this.stopReporting();
    this.stop();
    this.eventEmitter.removeAllListeners();
  }
}
