import type { PerformanceMetric } from '../../interfaces/IPerformanceMonitor';

export interface StatisticalCalculation {
  changePercent: number;
  hasRegression: boolean;
  confidence: number;
}

export class StatisticalAnalyzer {
  private regressionThreshold: number;
  private confidenceLevel: number;

  constructor(regressionThreshold: number, confidenceLevel: number) {
    this.regressionThreshold = regressionThreshold;
    this.confidenceLevel = confidenceLevel;
  }

  calculatePerformanceChange(
    current: PerformanceMetric,
    baseline: PerformanceMetric
  ): { changePercent: number; hasRegression: boolean } {
    const currentValue = current.p95 ?? current.average;
    const baselineValue = baseline.p95 ?? baseline.average;

    const changePercent = ((currentValue - baselineValue) / baselineValue) * 100;
    const hasRegression = changePercent > this.regressionThreshold;

    return { changePercent, hasRegression };
  }

  calculateRegressionConfidence(
    current: PerformanceMetric,
    baseline: PerformanceMetric
  ): number {
    const currentCV = this.calculateCV(current);
    const baselineCV = this.calculateCV(baseline);
    return this.calculateConfidence(currentCV, baselineCV, current.count, baseline.count);
  }

  private calculateCV(metric: PerformanceMetric): number {
    if (metric.average === 0) return 0;

    const estimatedStdDev = (metric.max - metric.min) / 4;
    return estimatedStdDev / metric.average;
  }

  private calculateConfidence(
    currentCV: number,
    baselineCV: number,
    currentCount: number,
    baselineCount: number
  ): number {
    const avgCV = (currentCV + baselineCV) / 2;
    const sampleFactor = Math.min(currentCount, baselineCount) / 100;
    const varianceFactor = Math.max(0, 1 - avgCV);

    return Math.min(1, sampleFactor * varianceFactor * 0.8 + 0.2);
  }

  calculateLinearRegression(
    points: Array<{ timestamp: number; value: number }>
  ): { slope: number; confidence: number } {
    if (points.length < 2) return { slope: 0, confidence: 0 };

    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.timestamp, 0);
    const sumY = points.reduce((sum, p) => sum + p.value, 0);
    const sumXY = points.reduce((sum, p) => sum + p.timestamp * p.value, 0);
    const sumXX = points.reduce((sum, p) => sum + p.timestamp * p.timestamp, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    const meanY = sumY / n;
    const ssTotal = points.reduce(
      (sum, p) => sum + Math.pow(p.value - meanY, 2),
      0
    );
    const ssResidual = points.reduce((sum, p) => {
      const predicted = slope * p.timestamp + (sumY - slope * sumX) / n;
      return sum + Math.pow(p.value - predicted, 2);
    }, 0);

    const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;
    const confidence = Math.max(0, Math.min(1, rSquared));

    return { slope, confidence };
  }
}