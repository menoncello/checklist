import type {
  MetricFilter,
  BenchmarkFilter,
  PerformanceMetric,
  PerformanceBenchmark,
  PerformanceAlert,
  SystemSnapshot,
} from './PerformanceMonitor';
import type { PerformanceMonitorInternal } from './PerformanceMonitorTypes';

/**
 * Reporting and statistics methods for PerformanceMonitor
 */
export class PerformanceMonitorReporting {
  constructor(private monitor: PerformanceMonitorInternal) {}

  public getStatistics(metricName: string): {
    count: number;
    min: number;
    max: number;
    average: number;
    median: number;
    p95: number;
  } {
    return this.monitor.core.getStatistics(metricName);
  }

  public getSystemSnapshot(): SystemSnapshot {
    return this.monitor.core.getSystemSnapshot();
  }

  public generateReport(): {
    metrics: PerformanceMetric[];
    benchmarks: PerformanceBenchmark[];
    alerts: PerformanceAlert[];
    systemSnapshot: SystemSnapshot;
  } {
    return this.monitor.core.generateReport();
  }

  // Data access
  public getMetrics(filter?: MetricFilter): PerformanceMetric[] {
    return this.monitor.core.getMetrics(filter);
  }

  public getBenchmarks(filter?: BenchmarkFilter): PerformanceBenchmark[] {
    return this.monitor.core.getBenchmarks(filter);
  }
}
