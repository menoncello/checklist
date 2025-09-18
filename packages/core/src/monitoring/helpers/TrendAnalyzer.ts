import type { PerformanceMetric } from '../../interfaces/IPerformanceMonitor';
import { StatisticalAnalyzer } from './StatisticalAnalyzer';

export interface TrendResult {
  operation: string;
  trendDirection: 'improving' | 'stable' | 'degrading';
  changeRate: number;
  dataPoints: Array<{
    timestamp: number;
    value: number;
  }>;
  prediction?: {
    nextValue: number;
    confidence: number;
  };
}

export class TrendAnalyzer {
  private statisticalAnalyzer: StatisticalAnalyzer;
  private trendWindow: number;
  private minSamples: number;

  constructor(
    statisticalAnalyzer: StatisticalAnalyzer,
    trendWindow: number,
    minSamples: number
  ) {
    this.statisticalAnalyzer = statisticalAnalyzer;
    this.trendWindow = trendWindow;
    this.minSamples = minSamples;
  }

  analyzeTrends(
    historicalData: Map<
      string,
      Array<{ timestamp: number; metric: PerformanceMetric }>
    >
  ): TrendResult[] {
    const results: TrendResult[] = [];

    for (const [operation, history] of historicalData) {
      if (history.length < this.minSamples) continue;

      const trendResult = this.calculateTrend(operation, history);
      results.push(trendResult);
    }

    return results;
  }

  private calculateTrend(
    operation: string,
    history: Array<{ timestamp: number; metric: PerformanceMetric }>
  ): TrendResult {
    const recentHistory = history.slice(-this.trendWindow);
    const dataPoints = recentHistory.map((h) => ({
      timestamp: h.timestamp,
      value: h.metric.p95 ?? h.metric.average,
    }));

    const { slope, confidence } =
      this.statisticalAnalyzer.calculateLinearRegression(dataPoints);

    const trendDirection = this.determineTrendDirection(slope, confidence);
    const changeRate = slope;

    const lastPoint = dataPoints[dataPoints.length - 1];
    const timeDelta = 60000;
    const nextValue = lastPoint.value + slope * timeDelta;

    return {
      operation,
      trendDirection,
      changeRate,
      dataPoints,
      prediction: {
        nextValue: Math.max(0, nextValue),
        confidence,
      },
    };
  }

  private determineTrendDirection(
    slope: number,
    confidence: number
  ): TrendResult['trendDirection'] {
    if (confidence < 0.3) return 'stable';

    const threshold = 0.001;

    if (slope > threshold) return 'degrading';
    if (slope < -threshold) return 'improving';
    return 'stable';
  }
}
