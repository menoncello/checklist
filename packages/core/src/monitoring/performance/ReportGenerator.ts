import { BottleneckDetector } from './BottleneckDetector.js';
import type {
  CPUProfile,
  PerformanceBottleneck,
  ProfilingReport,
  TopOperation,
  MemoryAnalysis
} from './types.js';

/**
 * Performance report generation and recommendations
 */
export class ReportGenerator {
  constructor(private bottleneckDetector: BottleneckDetector) {}

  /**
   * Generate comprehensive profiling report
   */
  generateProfilingReport(
    cpuProfiles: CPUProfile[],
    memoryAnalysis: MemoryAnalysis,
    memorySnapshotsCount: number
  ): ProfilingReport {
    const { totalDuration, averageDuration } = this.calculateDurationStats(cpuProfiles);
    const bottlenecks = this.findAllBottlenecks(cpuProfiles);
    const topOperations = this.getTopOperations(cpuProfiles);
    const recommendations = this.generateRecommendations(bottlenecks, memoryAnalysis);

    return {
      summary: {
        totalOperations: cpuProfiles.length,
        totalDuration,
        averageDuration,
        memorySnapshots: memorySnapshotsCount,
        bottlenecksDetected: bottlenecks.length,
      },
      memoryAnalysis,
      topOperations,
      bottlenecks,
      recommendations,
    };
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(
    bottlenecks: PerformanceBottleneck[],
    memoryAnalysis: MemoryAnalysis
  ): string[] {
    const recommendations: string[] = [];

    this.addCriticalBottleneckRecommendations(bottlenecks, recommendations);
    this.addMemoryRecommendations(memoryAnalysis, recommendations);
    this.addCPURecommendations(bottlenecks, recommendations);
    this.addDurationRecommendations(bottlenecks, recommendations);
    this.addGeneralRecommendations(recommendations);

    return recommendations;
  }

  private calculateDurationStats(cpuProfiles: CPUProfile[]): {
    totalDuration: number;
    averageDuration: number;
  } {
    const totalDuration = cpuProfiles.reduce((sum, p) => sum + p.duration, 0);
    const averageDuration = cpuProfiles.length > 0 ? totalDuration / cpuProfiles.length : 0;
    return { totalDuration, averageDuration };
  }

  private findAllBottlenecks(cpuProfiles: CPUProfile[]): PerformanceBottleneck[] {
    const bottlenecks: PerformanceBottleneck[] = [];
    for (const profile of cpuProfiles) {
      const bottleneck = this.bottleneckDetector.detectBottleneck(profile);
      if (bottleneck) {
        bottlenecks.push(bottleneck);
      }
    }
    return bottlenecks;
  }

  private getTopOperations(cpuProfiles: CPUProfile[]): TopOperation[] {
    return cpuProfiles
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)
      .map((p) => ({
        operation: p.operation,
        duration: p.duration,
        cpuTime: p.cpuUsage ? (p.cpuUsage.user + p.cpuUsage.system) / 1000 : undefined,
      }));
  }

  private addCriticalBottleneckRecommendations(
    bottlenecks: PerformanceBottleneck[],
    recommendations: string[]
  ): void {
    const criticalBottlenecks = bottlenecks.filter((b) => b.severity === 'critical');
    if (criticalBottlenecks.length > 0) {
      recommendations.push(
        `🔴 CRITICAL: ${criticalBottlenecks.length} critical performance bottlenecks detected. Immediate action required.`
      );
    }
  }

  private addMemoryRecommendations(
    memoryAnalysis: MemoryAnalysis,
    recommendations: string[]
  ): void {
    if (memoryAnalysis.trend === 'growing') {
      recommendations.push(
        `🔍 Memory usage is growing at ${(memoryAnalysis.growth / 1024 / 1024).toFixed(2)}MB/sec. Investigate for memory leaks.`
      );
    }

    if (memoryAnalysis.trend === 'volatile') {
      recommendations.push(
        `📊 Memory usage is volatile (σ=${(memoryAnalysis.volatility / 1024 / 1024).toFixed(2)}MB). Consider object pooling.`
      );
    }
  }

  private addCPURecommendations(
    bottlenecks: PerformanceBottleneck[],
    recommendations: string[]
  ): void {
    const cpuBottlenecks = bottlenecks.filter((b) => b.type === 'cpu');
    if (cpuBottlenecks.length > 2) {
      recommendations.push(
        `⚡ ${cpuBottlenecks.length} CPU-intensive operations detected. Consider async processing or Worker threads.`
      );
    }
  }

  private addDurationRecommendations(
    bottlenecks: PerformanceBottleneck[],
    recommendations: string[]
  ): void {
    const slowOperations = bottlenecks.filter(
      (b) =>
        b.metrics.duration !== null &&
        b.metrics.duration !== undefined &&
        b.metrics.duration > 500
    );
    if (slowOperations.length > 0) {
      recommendations.push(
        `🐌 ${slowOperations.length} slow operations (>500ms) detected. Profile and optimize these operations.`
      );
    }
  }

  private addGeneralRecommendations(recommendations: string[]): void {
    if (recommendations.length === 0) {
      recommendations.push(
        '✅ No major performance issues detected. Consider periodic profiling to maintain performance.'
      );
    }
  }
}