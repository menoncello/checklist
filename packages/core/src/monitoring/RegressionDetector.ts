import type {
  PerformanceReport,
  PerformanceMetric,
} from '../interfaces/IPerformanceMonitor';
import type { Logger } from '../utils/logger';
import { RegressionClassifier } from './helpers/RegressionClassifier';
import { RegressionReportGenerator } from './helpers/RegressionReportGenerator';
import { StatisticalAnalyzer } from './helpers/StatisticalAnalyzer';
import { TrendAnalyzer, TrendResult } from './helpers/TrendAnalyzer';

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

export { TrendResult } from './helpers/TrendAnalyzer';

/**
 * Performance regression detector
 */
export class PerformanceRegressionDetector {
  private config: RegressionConfig;
  private logger: Logger;
  private statisticalAnalyzer: StatisticalAnalyzer;
  private trendAnalyzer: TrendAnalyzer;
  private reportGenerator: RegressionReportGenerator;
  private classifier: RegressionClassifier;
  private historicalData: Map<
    string,
    Array<{
      timestamp: number;
      metric: PerformanceMetric;
    }>
  > = new Map();

  constructor(config: Partial<RegressionConfig>, logger: Logger) {
    this.config = {
      regressionThreshold: 20,
      minSamples: 5,
      confidenceLevel: 0.8,
      enableTrendAnalysis: true,
      trendWindow: 10,
      ...config,
    };
    this.logger = logger;
    this.statisticalAnalyzer = new StatisticalAnalyzer(
      this.config.regressionThreshold,
      this.config.confidenceLevel
    );
    this.trendAnalyzer = new TrendAnalyzer(
      this.statisticalAnalyzer,
      this.config.trendWindow,
      this.config.minSamples
    );
    this.reportGenerator = new RegressionReportGenerator();
    this.classifier = new RegressionClassifier();
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

      if (!this.hasValidBaseline(operation, baselineMetric)) {
        continue;
      }

      if (
        !this.hasSufficientSamples(operation, currentMetric, baselineMetric)
      ) {
        continue;
      }

      const result = this.analyzeRegression(
        operation,
        currentMetric,
        baselineMetric
      );
      results.push(result);

      this.logRegressionResult(result);
    }

    return this.sortRegressionResults(results);
  }

  private analyzeRegression(
    operation: string,
    current: PerformanceMetric,
    baseline: PerformanceMetric
  ): RegressionResult {
    const analysisResults = this.calculateRegressionMetrics(current, baseline);
    const severity = this.classifier.determineSeverity(
      analysisResults.changePercent,
      analysisResults.confidence
    );
    const recommendation = this.classifier.generateRecommendation(
      severity,
      analysisResults.changePercent,
      operation
    );

    return {
      operation,
      hasRegression: analysisResults.hasRegression,
      severity,
      currentMetric: current,
      baselineMetric: baseline,
      changePercent: analysisResults.changePercent,
      confidence: analysisResults.confidence,
      recommendation,
    };
  }

  private calculateRegressionMetrics(
    current: PerformanceMetric,
    baseline: PerformanceMetric
  ): { changePercent: number; hasRegression: boolean; confidence: number } {
    const { changePercent, hasRegression } =
      this.statisticalAnalyzer.calculatePerformanceChange(current, baseline);
    const confidence = this.statisticalAnalyzer.calculateRegressionConfidence(
      current,
      baseline
    );
    return { changePercent, hasRegression, confidence };
  }

  /**
   * Check if baseline data is available for the operation
   */
  private hasValidBaseline(
    operation: string,
    baselineMetric: PerformanceMetric | undefined
  ): boolean {
    if (baselineMetric === undefined) {
      this.logger.debug({
        msg: 'No baseline data for operation',
        operation,
      });
      return false;
    }
    return true;
  }

  /**
   * Check if there are sufficient samples for comparison
   */
  private hasSufficientSamples(
    operation: string,
    currentMetric: PerformanceMetric,
    baselineMetric: PerformanceMetric
  ): boolean {
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
      return false;
    }
    return true;
  }

  /**
   * Log regression detection result
   */
  private logRegressionResult(result: RegressionResult): void {
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

  private sortRegressionResults(
    results: RegressionResult[]
  ): RegressionResult[] {
    return this.classifier.sortRegressionResults(results);
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

  analyzeTrends(): TrendResult[] {
    if (!this.config.enableTrendAnalysis) return [];
    return this.trendAnalyzer.analyzeTrends(this.historicalData);
  }

  generateRegressionReport(regressions: RegressionResult[]): string {
    return this.reportGenerator.generateRegressionReport(regressions);
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
