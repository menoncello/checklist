import { PerformanceMetrics } from '../framework/UIFramework';
import { PerformanceMonitor } from '../performance/PerformanceMonitor';

export class ApplicationShellPerformance {
  private performanceMonitor: PerformanceMonitor;
  private startupStartTime = 0;
  private lastRenderDuration = 0;

  constructor(performanceMonitor: PerformanceMonitor) {
    this.performanceMonitor = performanceMonitor;
  }

  public setStartupStartTime(time: number): void {
    this.startupStartTime = time;
  }

  public recordStartupMetrics(startTime: number): void {
    const startupTime = performance.now() - startTime;
    this.performanceMonitor.recordMetricValue('startup_time', startupTime);
  }

  public setLastRenderDuration(duration: number): void {
    this.lastRenderDuration = duration;
  }

  public getMetrics(): PerformanceMetrics {
    const report = this.performanceMonitor.generateReport();
    const systemSnapshot = report.systemSnapshot;

    // Find startup time from metrics
    const startupMetric = report.metrics.find((m) => m.name === 'startup_time');
    const startupTime =
      startupMetric?.value ??
      (this.startupStartTime > 0
        ? performance.now() - this.startupStartTime
        : 0);

    // Find render time from benchmarks
    const renderBenchmark = report.benchmarks.find(
      (b: { name?: string; category?: string }) =>
        Boolean(b.name?.includes('render')) || b.category === 'rendering'
    );
    const renderTime = renderBenchmark?.duration ?? this.lastRenderDuration;

    return {
      startupTime,
      renderTime,
      memoryUsage: systemSnapshot.memory.heapUsed,
      frameRate: 60, // Default target FPS
      lastRenderDuration: this.lastRenderDuration,
    };
  }

  public startProfiling(name: string): void {
    this.performanceMonitor.startBenchmark(name, 'profiling');
  }

  public endProfiling(name: string): number {
    const benchmark = this.performanceMonitor.endBenchmark(name);
    return benchmark?.duration ?? 0;
  }

  public getPerformanceReport(): unknown {
    return this.performanceMonitor.generateReport();
  }
}
