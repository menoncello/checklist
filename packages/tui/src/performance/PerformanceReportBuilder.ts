import type { MemoryTracker } from './MemoryTracker';
import type { MetricsCollector } from './MetricsCollector';
import type { PerformanceReport } from './PerformanceManagerTypes';
import type { PerformanceMonitor } from './PerformanceMonitor';
import type { StartupProfiler } from './StartupProfiler';

export class PerformanceReportBuilder {
  constructor(
    private monitor: PerformanceMonitor,
    private memoryTracker: MemoryTracker,
    private metricsCollector: MetricsCollector,
    private startupProfiler: StartupProfiler
  ) {}

  generateReport(): PerformanceReport {
    return {
      timestamp: Date.now(),
      metrics: this.getMetrics(),
      system: this.getSystemInfo(),
      benchmarks: this.getBenchmarks(),
      startup: this.getStartupProfile(),
    };
  }

  build(): PerformanceReport {
    return this.generateReport();
  }

  private getMetrics(): PerformanceReport['metrics'] {
    return {
      sampleRate: 0,
      ...this.metricsCollector.getMetrics(),
    };
  }

  private getSystemInfo(): PerformanceReport['system'] {
    const memorySnapshot = this.memoryTracker.getCurrentSnapshot() as {
      heapUsed: number;
      heapTotal: number;
      external: number;
    } | null;

    return {
      memory: {
        heapUsed: memorySnapshot?.heapUsed ?? 0,
        heapTotal: memorySnapshot?.heapTotal ?? 0,
        external: memorySnapshot?.external ?? 0,
      },
    };
  }

  private getBenchmarks(): unknown[] {
    if (
      'getBenchmarks' in this.monitor &&
      typeof this.monitor.getBenchmarks === 'function'
    ) {
      return this.monitor.getBenchmarks();
    }
    return [];
  }

  private getStartupProfile(): unknown {
    if (
      'getProfile' in this.startupProfiler &&
      typeof this.startupProfiler.getProfile === 'function'
    ) {
      return this.startupProfiler.getProfile();
    }
    return undefined;
  }
}
