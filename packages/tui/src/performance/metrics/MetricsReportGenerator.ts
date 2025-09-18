import {
  MetricSeries,
  MetricsReport,
  CollectorMetrics,
  MetricAlert,
} from './types';

export class MetricsReportGenerator {
  constructor(
    private collectionStartTime: number,
    private totalPointsCollected: number
  ) {}

  generateReport(
    series: Map<string, MetricSeries>,
    alerts: MetricAlert[],
    timeRange?: { start: number; end: number }
  ): MetricsReport {
    const now = Date.now();
    const range = timeRange ?? {
      start: this.collectionStartTime,
      end: now,
    };

    return {
      generatedAt: now,
      timeRange: range,
      summary: this.createSummary(series),
      series: Array.from(series.values()),
      alerts,
      recommendations: this.generateRecommendations(series),
      performance: this.getCollectorMetrics(),
    };
  }

  private createSummary(series: Map<string, MetricSeries>) {
    let totalPoints = 0;
    const metrics = new Map<string, { count: number; avgValue: number }>();

    for (const [name, s] of series) {
      totalPoints += s.points.length;
      metrics.set(name, {
        count: s.points.length,
        avgValue: s.aggregations.avg,
      });
    }

    const duration = Date.now() - this.collectionStartTime;
    const sampleRate = duration > 0 ? (totalPoints / duration) * 1000 : 0; // points per second

    return {
      totalMetrics: series.size,
      totalPoints,
      uniqueSeries: series.size,
      sampleRate,
      metricsBreakdown: Object.fromEntries(metrics),
    };
  }

  private generateRecommendations(series: Map<string, MetricSeries>): string[] {
    const recommendations: string[] = [];

    for (const [name, s] of series) {
      if (this.hasHighVariability(s)) {
        recommendations.push(
          `Metric '${name}' shows high variability - consider reviewing data collection`
        );
      }

      if (this.hasConsistentGrowth(s)) {
        recommendations.push(
          `Metric '${name}' shows consistent growth - possible memory leak or unbounded resource`
        );
      }

      if (this.hasSpikePatterns(s)) {
        recommendations.push(
          `Metric '${name}' has spike patterns - investigate periodic issues`
        );
      }
    }

    return recommendations;
  }

  private hasHighVariability(series: MetricSeries): boolean {
    if (series.points.length < 10) return false;

    const values = series.points.map((p) => p.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = mean !== 0 ? stdDev / mean : 0;

    return coefficientOfVariation > 0.5;
  }

  private hasConsistentGrowth(series: MetricSeries): boolean {
    if (series.points.length < 5) return false;

    const values = series.points.map((p) => p.value);
    let increasingCount = 0;

    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i - 1]) {
        increasingCount++;
      }
    }

    const increaseRatio = increasingCount / (values.length - 1);
    return increaseRatio > 0.8;
  }

  private hasSpikePatterns(series: MetricSeries): boolean {
    if (series.points.length < 10) return false;

    const values = series.points.map((p) => p.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
    );

    const threshold = mean + stdDev * 2;
    const spikeCount = values.filter((v) => v > threshold).length;

    return spikeCount > values.length * 0.1;
  }

  private getCollectorMetrics(): CollectorMetrics {
    const now = Date.now();
    const memUsage = process.memoryUsage();
    return {
      totalCollected: this.totalPointsCollected,
      bufferSize: 0, // Would need to be tracked
      memoryUsage: memUsage.heapUsed,
      processedPerSecond:
        this.totalPointsCollected / ((now - this.collectionStartTime) / 1000),
      collectionRate:
        this.totalPointsCollected / ((now - this.collectionStartTime) / 1000),
      errorsCount: 0, // Would need to be tracked
      totalPointsCollected: this.totalPointsCollected,
      uptime: now - this.collectionStartTime,
    };
  }

  setTotalPointsCollected(count: number): void {
    this.totalPointsCollected = count;
  }
}
