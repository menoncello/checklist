import type {
  PerformanceReport,
  PerformanceMetric,
} from '../interfaces/IPerformanceMonitor';
import type { Logger } from '../utils/logger';

/**
 * Performance regression detection configuration
 */
export interface RegressionConfig {
  /** Threshold percentage for detecting regressions (e.g., 20 = 20% slower) */
  regressionThreshold: number;
  /** Minimum number of samples required for comparison */
  minSamples: number;
  /** Statistical confidence level (0.8 = 80%) */
  confidenceLevel: number;
  /** Enable trend analysis over multiple data points */
  enableTrendAnalysis: boolean;
  /** Window size for trend analysis */
  trendWindow: number;
}

/**
 * Regression detection result
 */
export interface RegressionResult {
  operation: string;
  hasRegression: boolean;
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  currentMetric: PerformanceMetric;
  baselineMetric: PerformanceMetric;
  changePercent: number;
  confidence: number;
  recommendation: string;
}

/**
 * Trend analysis result
 */
export interface TrendResult {
  operation: string;
  trendDirection: 'improving' | 'stable' | 'degrading';
  changeRate: number; // change per time unit
  dataPoints: Array<{
    timestamp: number;
    value: number;
  }>;
  prediction?: {
    nextValue: number;
    confidence: number;
  };
}

/**
 * Performance regression detector
 */
export class PerformanceRegressionDetector {
  private config: RegressionConfig;
  private logger: Logger;
  private historicalData: Map<
    string,
    Array<{
      timestamp: number;
      metric: PerformanceMetric;
    }>
  > = new Map();

  constructor(config: Partial<RegressionConfig>, logger: Logger) {
    this.config = {
      regressionThreshold: 20, // 20% slower is considered regression
      minSamples: 5,
      confidenceLevel: 0.8,
      enableTrendAnalysis: true,
      trendWindow: 10,
      ...config,
    };
    this.logger = logger;
  }

  /**
   * Compare current performance report with baseline
   */
  detectRegressions(
    currentReport: PerformanceReport,
    baselineReport: PerformanceReport
  ): RegressionResult[] {
    const results: RegressionResult[] = [];

    for (const [operation, currentMetric] of Object.entries(
      currentReport.metrics
    )) {
      const baselineMetric = baselineReport.metrics[operation];

      if (baselineMetric === undefined) {
        this.logger.debug({
          msg: 'No baseline data for operation',
          operation,
        });
        continue;
      }

      // Check minimum sample requirements
      if (
        currentMetric.count < this.config.minSamples ||
        baselineMetric.count < this.config.minSamples
      ) {
        this.logger.debug({
          msg: 'Insufficient samples for operation',
          operation,
          currentSamples: currentMetric.count,
          baselineSamples: baselineMetric.count,
          minRequired: this.config.minSamples,
        });
        continue;
      }

      const result = this.analyzeRegression(
        operation,
        currentMetric,
        baselineMetric
      );
      results.push(result);

      if (result.hasRegression) {
        this.logger.warn({
          msg: 'Performance regression detected',
          operation: result.operation,
          severity: result.severity,
          changePercent: result.changePercent,
          confidence: result.confidence,
        });
      }
    }

    return results.sort((a, b) => b.changePercent - a.changePercent);
  }

  /**
   * Analyze individual operation for regression
   */
  private analyzeRegression(
    operation: string,
    current: PerformanceMetric,
    baseline: PerformanceMetric
  ): RegressionResult {
    // Use P95 if available, otherwise average
    const currentValue = current.p95 ?? current.average;
    const baselineValue = baseline.p95 ?? baseline.average;

    const changePercent =
      ((currentValue - baselineValue) / baselineValue) * 100;
    const hasRegression = changePercent > this.config.regressionThreshold;

    // Calculate statistical confidence using coefficient of variation
    const currentCV = this.calculateCV(current);
    const baselineCV = this.calculateCV(baseline);
    const confidence = this.calculateConfidence(
      currentCV,
      baselineCV,
      current.count,
      baseline.count
    );

    const severity = this.determineSeverity(changePercent, confidence);
    const recommendation = this.generateRecommendation(
      severity,
      changePercent,
      operation
    );

    return {
      operation,
      hasRegression,
      severity,
      currentMetric: current,
      baselineMetric: baseline,
      changePercent,
      confidence,
      recommendation,
    };
  }

  /**
   * Calculate coefficient of variation for stability assessment
   */
  private calculateCV(metric: PerformanceMetric): number {
    if (metric.average === 0) return 0;

    // Estimate standard deviation from min/max (rough approximation)
    const estimatedStdDev = (metric.max - metric.min) / 4; // Rough estimate
    return estimatedStdDev / metric.average;
  }

  /**
   * Calculate statistical confidence in the regression detection
   */
  private calculateConfidence(
    currentCV: number,
    baselineCV: number,
    currentCount: number,
    baselineCount: number
  ): number {
    // Simple confidence calculation based on sample size and variance
    const avgCV = (currentCV + baselineCV) / 2;
    const sampleFactor = Math.min(currentCount, baselineCount) / 100; // Normalize to 0-1
    const varianceFactor = Math.max(0, 1 - avgCV); // Lower variance = higher confidence

    return Math.min(1, sampleFactor * varianceFactor * 0.8 + 0.2);
  }

  /**
   * Determine severity of regression
   */
  private determineSeverity(
    changePercent: number,
    confidence: number
  ): RegressionResult['severity'] {
    if (confidence < 0.5) return 'minor'; // Low confidence

    if (changePercent >= 100) return 'critical'; // 100%+ slower
    if (changePercent >= 50) return 'major'; // 50-99% slower
    if (changePercent >= 25) return 'moderate'; // 25-49% slower
    return 'minor'; // 20-24% slower
  }

  /**
   * Generate actionable recommendation
   */
  private generateRecommendation(
    severity: RegressionResult['severity'],
    changePercent: number,
    operation: string
  ): string {
    switch (severity) {
      case 'critical':
        return `URGENT: ${operation} is ${changePercent.toFixed(1)}% slower. Immediate investigation required. Consider rollback if affecting users.`;
      case 'major':
        return `HIGH PRIORITY: ${operation} shows significant performance degradation (${changePercent.toFixed(1)}%). Profile the operation to identify bottlenecks.`;
      case 'moderate':
        return `MEDIUM PRIORITY: ${operation} performance declined by ${changePercent.toFixed(1)}%. Review recent changes and optimize if possible.`;
      case 'minor':
        return `LOW PRIORITY: Minor regression in ${operation} (${changePercent.toFixed(1)}%). Monitor for continued degradation.`;
    }
  }

  /**
   * Add historical data point for trend analysis
   */
  addDataPoint(operation: string, metric: PerformanceMetric): void {
    if (!this.config.enableTrendAnalysis) return;

    const history = this.historicalData.get(operation) ?? [];
    history.push({
      timestamp: Date.now(),
      metric,
    });

    // Keep only the most recent data points
    if (history.length > this.config.trendWindow * 2) {
      history.splice(0, history.length - this.config.trendWindow);
    }

    this.historicalData.set(operation, history);
  }

  /**
   * Analyze performance trends over time
   */
  analyzeTrends(): TrendResult[] {
    if (!this.config.enableTrendAnalysis) return [];

    const results: TrendResult[] = [];

    for (const [operation, history] of this.historicalData) {
      if (history.length < this.config.minSamples) continue;

      const trendResult = this.calculateTrend(operation, history);
      results.push(trendResult);
    }

    return results;
  }

  /**
   * Calculate trend for specific operation
   */
  private calculateTrend(
    operation: string,
    history: Array<{ timestamp: number; metric: PerformanceMetric }>
  ): TrendResult {
    const recentHistory = history.slice(-this.config.trendWindow);
    const dataPoints = recentHistory.map((h) => ({
      timestamp: h.timestamp,
      value: h.metric.p95 ?? h.metric.average,
    }));

    // Simple linear regression for trend calculation
    const { slope, confidence } = this.calculateLinearRegression(dataPoints);

    const trendDirection = this.determineTrendDirection(slope, confidence);
    const changeRate = slope; // Change per millisecond

    // Simple prediction (next data point)
    const lastPoint = dataPoints[dataPoints.length - 1];
    const timeDelta = 60000; // Predict 1 minute ahead
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

  /**
   * Simple linear regression calculation
   */
  private calculateLinearRegression(
    points: Array<{ timestamp: number; value: number }>
  ): { slope: number; confidence: number } {
    if (points.length < 2) return { slope: 0, confidence: 0 };

    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.timestamp, 0);
    const sumY = points.reduce((sum, p) => sum + p.value, 0);
    const sumXY = points.reduce((sum, p) => sum + p.timestamp * p.value, 0);
    const sumXX = points.reduce((sum, p) => sum + p.timestamp * p.timestamp, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // Calculate R-squared for confidence
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

  /**
   * Determine trend direction
   */
  private determineTrendDirection(
    slope: number,
    confidence: number
  ): TrendResult['trendDirection'] {
    if (confidence < 0.3) return 'stable'; // Low confidence = stable

    const threshold = 0.001; // Adjust based on your metrics scale

    if (slope > threshold) return 'degrading'; // Performance getting worse
    if (slope < -threshold) return 'improving'; // Performance getting better
    return 'stable';
  }

  /**
   * Generate regression summary report
   */
  generateRegressionReport(regressions: RegressionResult[]): string {
    if (regressions.length === 0) {
      return '✅ No performance regressions detected.';
    }

    const lines = ['🚨 Performance Regression Report\n'];

    const critical = regressions.filter((r) => r.severity === 'critical');
    const major = regressions.filter((r) => r.severity === 'major');
    const moderate = regressions.filter((r) => r.severity === 'moderate');
    const minor = regressions.filter((r) => r.severity === 'minor');

    lines.push(
      `Summary: ${critical.length} critical, ${major.length} major, ${moderate.length} moderate, ${minor.length} minor\n`
    );

    [
      { severity: 'critical', items: critical, emoji: '🔴' },
      { severity: 'major', items: major, emoji: '🟠' },
      { severity: 'moderate', items: moderate, emoji: '🟡' },
      { severity: 'minor', items: minor, emoji: '🟢' },
    ].forEach(({ severity, items, emoji }) => {
      if (items.length > 0) {
        lines.push(`${emoji} ${severity.toUpperCase()} Regressions:`);
        items.forEach((item) => {
          lines.push(
            `  • ${item.operation}: +${item.changePercent.toFixed(1)}% (${item.confidence.toFixed(2)} confidence)`
          );
          lines.push(`    ${item.recommendation}`);
        });
        lines.push('');
      }
    });

    return lines.join('\n');
  }

  /**
   * Clear historical data (useful for testing)
   */
  clearHistory(): void {
    this.historicalData.clear();
    this.logger.debug({
      msg: 'Performance regression detector history cleared',
    });
  }
}

/**
 * Utility function to create a regression detector with default config
 */
export function createRegressionDetector(
  logger: Logger
): PerformanceRegressionDetector {
  const config: Partial<RegressionConfig> = {
    regressionThreshold: Number(Bun.env.PERFORMANCE_REGRESSION_THRESHOLD) || 20,
    minSamples: Number(Bun.env.PERFORMANCE_MIN_SAMPLES) || 5,
    confidenceLevel: Number(Bun.env.PERFORMANCE_CONFIDENCE_LEVEL) || 0.8,
    enableTrendAnalysis: Bun.env.PERFORMANCE_ENABLE_TRENDS !== 'false',
    trendWindow: Number(Bun.env.PERFORMANCE_TREND_WINDOW) || 10,
  };

  return new PerformanceRegressionDetector(config, logger);
}
