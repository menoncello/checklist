import type { AlertManager, PerformanceAlert } from './AlertManager';
import type {
  BenchmarkManager,
  PerformanceBenchmark,
} from './BenchmarkManager';
import type { MetricsTracker, PerformanceMetric } from './MetricsTracker';
import type { SystemProfiler, SystemSnapshot } from './SystemProfiler';

export interface PerformanceReport {
  metrics: PerformanceMetric[];
  benchmarks: PerformanceBenchmark[];
  alerts: PerformanceAlert[];
  systemSnapshot: SystemSnapshot;
}

export class ReportGenerator {
  constructor(
    private metricsTracker: MetricsTracker,
    private benchmarkManager: BenchmarkManager,
    private alertManager: AlertManager,
    private systemProfiler: SystemProfiler
  ) {}

  generateReport(): PerformanceReport {
    return {
      metrics: this.metricsTracker.getMetrics(),
      benchmarks: this.benchmarkManager.getBenchmarks(),
      alerts: this.alertManager.getAlerts(),
      systemSnapshot: this.systemProfiler.getSystemSnapshot(),
    };
  }
}
