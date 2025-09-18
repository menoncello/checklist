import type {
  CPUProfile,
  MemorySnapshot,
  PerformanceBottleneck,
  ProfilingConfig,
} from './types.js';

/**
 * Bottleneck detection and analysis
 */
export class BottleneckDetector {
  constructor(private config: ProfilingConfig) {}

  /**
   * Detect performance bottlenecks in a profile
   */
  detectBottleneck(
    profile: CPUProfile,
    startMemory?: MemorySnapshot,
    currentMemorySnapshots: MemorySnapshot[] = []
  ): PerformanceBottleneck | null {
    const bottlenecks: PerformanceBottleneck[] = [];

    this.checkDurationBottleneck(profile, bottlenecks);
    this.checkMemoryBottleneck(
      profile,
      startMemory,
      bottlenecks,
      currentMemorySnapshots
    );
    this.checkCPUBottleneck(profile, bottlenecks);

    return this.getMostSevereBottleneck(bottlenecks);
  }

  private checkDurationBottleneck(
    profile: CPUProfile,
    bottlenecks: PerformanceBottleneck[]
  ): void {
    if (profile.duration <= this.config.bottleneckThresholds.duration) {
      return;
    }

    const severity = this.getDurationSeverity(profile.duration);
    bottlenecks.push({
      operation: profile.operation,
      type: 'cpu',
      severity,
      description: `Operation took ${profile.duration.toFixed(2)}ms, exceeding threshold of ${this.config.bottleneckThresholds.duration}ms`,
      recommendation: this.getDurationRecommendation(profile.duration),
      metrics: { duration: profile.duration },
    });
  }

  private checkMemoryBottleneck(
    profile: CPUProfile,
    startMemory: MemorySnapshot | undefined,
    bottlenecks: PerformanceBottleneck[],
    currentMemorySnapshots: MemorySnapshot[]
  ): void {
    if (!startMemory || currentMemorySnapshots.length === 0) {
      return;
    }

    const currentMemory =
      currentMemorySnapshots[currentMemorySnapshots.length - 1];
    const memoryDelta = currentMemory.heapUsed - startMemory.heapUsed;

    if (memoryDelta <= this.config.bottleneckThresholds.memoryGrowth) {
      return;
    }

    const severity = this.getMemorySeverity(memoryDelta);
    bottlenecks.push({
      operation: profile.operation,
      type: 'memory',
      severity,
      description: `Operation increased memory usage by ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`,
      recommendation: this.getMemoryRecommendation(memoryDelta),
      metrics: { memoryDelta },
    });
  }

  private checkCPUBottleneck(
    profile: CPUProfile,
    bottlenecks: PerformanceBottleneck[]
  ): void {
    if (!profile.cpuUsage) {
      return;
    }

    const cpuTime = (profile.cpuUsage.user + profile.cpuUsage.system) / 1000; // Convert to ms
    const cpuPercent = (cpuTime / profile.duration) * 100;

    if (cpuPercent <= this.config.bottleneckThresholds.cpuUsage) {
      return;
    }

    const severity = this.getCPUSeverity(cpuPercent);
    bottlenecks.push({
      operation: profile.operation,
      type: 'cpu',
      severity,
      description: `Operation used ${cpuPercent.toFixed(1)}% CPU, exceeding threshold of ${this.config.bottleneckThresholds.cpuUsage}%`,
      recommendation: this.getCPURecommendation(cpuPercent),
      metrics: { cpuTime },
    });
  }

  private getMostSevereBottleneck(
    bottlenecks: PerformanceBottleneck[]
  ): PerformanceBottleneck | null {
    return (
      bottlenecks.sort(
        (a, b) =>
          this.getSeverityWeight(b.severity) -
          this.getSeverityWeight(a.severity)
      )[0] ?? null
    );
  }

  private getDurationSeverity(
    duration: number
  ): PerformanceBottleneck['severity'] {
    if (duration > 1000) return 'critical'; // > 1s
    if (duration > 500) return 'high'; // > 500ms
    if (duration > 200) return 'medium'; // > 200ms
    return 'low';
  }

  private getDurationRecommendation(duration: number): string {
    if (duration > 1000) {
      return 'Consider breaking this operation into smaller chunks or implementing caching/memoization.';
    }
    if (duration > 500) {
      return 'Profile this operation to identify expensive computations or I/O operations.';
    }
    return 'Consider optimizing algorithms or reducing computational complexity.';
  }

  private getMemorySeverity(
    memoryDelta: number
  ): PerformanceBottleneck['severity'] {
    const mb = memoryDelta / 1024 / 1024;
    if (mb > 100) return 'critical'; // > 100MB
    if (mb > 50) return 'high'; // > 50MB
    if (mb > 20) return 'medium'; // > 20MB
    return 'low';
  }

  private getMemoryRecommendation(memoryDelta: number): string {
    const mb = memoryDelta / 1024 / 1024;
    if (mb > 100) {
      return 'URGENT: Investigate memory leaks. Consider streaming or batch processing for large datasets.';
    }
    if (mb > 50) {
      return 'Review object creation patterns and implement object pooling if appropriate.';
    }
    return 'Consider using WeakMap/WeakSet for caches or implementing garbage collection hints.';
  }

  private getCPUSeverity(
    cpuPercent: number
  ): PerformanceBottleneck['severity'] {
    if (cpuPercent > 95) return 'critical';
    if (cpuPercent > 90) return 'high';
    if (cpuPercent > 85) return 'medium';
    return 'low';
  }

  private getCPURecommendation(cpuPercent: number): string {
    if (cpuPercent > 95) {
      return 'URGENT: CPU-intensive operation blocking event loop. Consider Worker threads or async processing.';
    }
    if (cpuPercent > 90) {
      return 'High CPU usage detected. Profile to identify hot code paths and optimize algorithms.';
    }
    return 'Consider optimizing loops, reducing object creation, or using more efficient data structures.';
  }

  private getSeverityWeight(
    severity: PerformanceBottleneck['severity']
  ): number {
    switch (severity) {
      case 'critical':
        return 4;
      case 'high':
        return 3;
      case 'medium':
        return 2;
      case 'low':
        return 1;
    }
  }
}
