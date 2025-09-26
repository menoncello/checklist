import type { PerformanceReport } from './PerformanceManagerTypes';

export class PerformanceReportBuilder {
  private report: Partial<PerformanceReport> = {};

  constructor() {
    this.reset();
  }

  reset(): void {
    this.report = {
      timestamp: Date.now(),
      metrics: {},
      memory: {
        used: 0,
        total: 0,
        percentage: 0,
      },
      benchmarks: {},
      alerts: [],
    };
  }

  setMetrics(metrics: Record<string, unknown>): this {
    this.report.metrics = metrics;
    return this;
  }

  setMemory(memory: { used: number; total: number; percentage: number }): this {
    this.report.memory = memory;
    return this;
  }

  setBenchmarks(benchmarks: Record<string, unknown>): this {
    this.report.benchmarks = benchmarks;
    return this;
  }

  setAlerts(alerts: unknown[]): this {
    this.report.alerts = alerts;
    return this;
  }

  build(): PerformanceReport {
    return this.report as PerformanceReport;
  }
}
