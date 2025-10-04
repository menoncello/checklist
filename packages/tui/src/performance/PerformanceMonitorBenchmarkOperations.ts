import type { AlertManager } from './helpers/AlertManager';
import type {
  BenchmarkManager,
  BenchmarkFilter,
} from './helpers/BenchmarkManager';
import type { PerformanceMetric } from './helpers/MetricsTracker';
import type { PerformanceBenchmark, PerformanceMonitorConfig } from './types';

export class PerformanceMonitorBenchmarkOperations {
  constructor(
    private benchmarkManager: BenchmarkManager,
    private alertManager: AlertManager,
    private config: PerformanceMonitorConfig
  ) {}

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
    if (
      benchmark !== null &&
      this.config.enableAlerts &&
      benchmark.duration !== undefined
    ) {
      const metric: PerformanceMetric = {
        id: `benchmark-${Date.now()}`,
        name: 'benchmark.duration',
        value: benchmark.duration,
        timestamp: Date.now(),
        tags: { category: benchmark.category },
        metadata: benchmark.metadata,
      };
      const alert = this.alertManager.checkMetric(metric);

      if (alert) {
        this.alertManager.addAlert(alert);
      }
    }
    return benchmark;
  }

  public getBenchmarks(filter?: BenchmarkFilter): PerformanceBenchmark[] {
    return this.benchmarkManager.getBenchmarks(filter);
  }

  public clearBenchmarks(): void {
    this.benchmarkManager.clear();
  }
}
