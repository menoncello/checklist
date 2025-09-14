import type { MemorySnapshot, MemoryAnalysis } from './types.js';

/**
 * Memory usage pattern analysis
 */
export class MemoryAnalyzer {
  /**
   * Analyze memory usage patterns from snapshots
   */
  analyzeMemoryPattern(memorySnapshots: MemorySnapshot[]): MemoryAnalysis {
    if (memorySnapshots.length < 2) {
      return {
        trend: 'stable',
        growth: 0,
        peakUsage: 0,
        averageUsage: 0,
        volatility: 0,
      };
    }

    const snapshots = memorySnapshots;
    const heapValues = snapshots.map((s) => s.heapUsed);

    // Calculate trend
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const timeDelta = (last.timestamp - first.timestamp) / 1000; // seconds
    const growth =
      timeDelta > 0 ? (last.heapUsed - first.heapUsed) / timeDelta : 0;

    // Calculate statistics
    const peakUsage = Math.max(...heapValues);
    const averageUsage =
      heapValues.reduce((sum, val) => sum + val, 0) / heapValues.length;

    // Calculate volatility (standard deviation)
    const variance =
      heapValues.reduce(
        (sum, val) => sum + Math.pow(val - averageUsage, 2),
        0
      ) / heapValues.length;
    const volatility = Math.sqrt(variance);

    // Determine trend
    const trend = this.determineTrend(growth, volatility, averageUsage);

    return { trend, growth, peakUsage, averageUsage, volatility };
  }

  private determineTrend(
    growth: number,
    volatility: number,
    averageUsage: number
  ): MemoryAnalysis['trend'] {
    const growthThreshold = 1024 * 1024; // 1MB per second
    const volatilityThreshold = averageUsage * 0.1; // 10% of average

    if (volatility > volatilityThreshold) {
      return 'volatile';
    }
    if (growth > growthThreshold) {
      return 'growing';
    }
    if (growth < -growthThreshold) {
      return 'shrinking';
    }
    return 'stable';
  }
}