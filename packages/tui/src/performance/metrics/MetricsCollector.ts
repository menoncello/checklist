import { AlertManager } from './AlertManager';
import { MetricsAggregator } from './MetricsAggregator';
import { MetricsBuffer } from './MetricsBuffer';
import {
  MetricPoint,
  MetricSeries,
  MetricQuery,
  MetricsReport,
  MetricsCollectorConfig,
  CollectorMetrics,
} from './types';

export class MetricsCollector {
  private config: MetricsCollectorConfig;
  private buffer: MetricsBuffer;
  private alertManager: AlertManager;
  private aggregator: MetricsAggregator;
  private eventHandlers = new Map<string, Set<(...args: unknown[]) => void>>();
  private flushTimer: Timer | null = null;
  private aggregationTimer: Timer | null = null;
  private collectionStartTime = Date.now();
  private totalPointsCollected = 0;
  private isRunning = false;
  private series = new Map<string, MetricSeries>();
  private alertRules: import('./types').AlertRule[] = [];
  private alerts: import('./types').MetricAlert[] = [];

  constructor(config: Partial<MetricsCollectorConfig> = {}) {
    this.config = {
      bufferSize: 10000,
      flushInterval: 30000,
      aggregationInterval: 30000,
      retentionPeriod: 3600000,
      enableAlerting: true,
      enableAlerts: true,
      maxAlerts: 100,
      sampleRate: 1.0,
      enableCompression: false,
      compressionThreshold: 1000,
      enableCollection: true,
      enableAggregation: true,
      exportFormat: 'json',
      persistMetrics: false,
      ...config,
    };

    this.buffer = new MetricsBuffer(
      this.config.bufferSize,
      this.config.retentionPeriod
    );
    this.alertManager = new AlertManager(this.config.maxAlerts);
    this.aggregator = new MetricsAggregator();

    // Set up default alert rules
    this.setupDefaultAlertRules();
  }

  private setupDefaultAlertRules(): void {
    this.alertRules.push({
      id: 'high-memory',
      metric: 'memory_heap_used',
      condition: 'value > 0.8',
      severity: 'warning',
      message: 'High memory usage detected',
    });
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startCollection();
  }

  public recordMetric(
    name: string,
    value: number,
    metadata?: Record<string, unknown>
  ): void {
    const tags = metadata as Record<string, string> | undefined;
    this.record(name, value, tags);
  }

  public record(
    nameOrObj:
      | string
      | {
          name: string;
          value: number;
          tags?: Record<string, string>;
          metadata?: Record<string, unknown>;
        },
    value?: number,
    tags?: Record<string, string>,
    metadata?: Record<string, unknown>
  ): void {
    let name: string;
    let actualValue: number;
    let actualTags: Record<string, string> | undefined;
    let actualMetadata: Record<string, unknown> | undefined;

    if (typeof nameOrObj === 'object') {
      name = nameOrObj.name;
      actualValue = nameOrObj.value;
      actualTags = nameOrObj.tags;
      actualMetadata = nameOrObj.metadata;
    } else {
      name = nameOrObj;
      actualValue = value ?? 0;
      actualTags = tags;
      actualMetadata = metadata;
    }

    if (this.config.enableCollection !== true) return;
    if (!this.shouldSample()) return;

    const point: MetricPoint = {
      timestamp: Date.now(),
      value: actualValue,
      tags: actualTags ?? {},
      metadata: { ...actualMetadata, metric: name },
    };

    this.buffer.addPoint(name, point);
    this.totalPointsCollected++;

    // Update or create series
    let series = this.series.get(name);
    if (!series) {
      series = {
        name,
        points: [],
        aggregations: {
          count: 0,
          sum: 0,
          avg: 0,
          min: Infinity,
          max: -Infinity,
          p50: 0,
          p95: 0,
          p99: 0,
          latest: 0,
        },
        tags: actualTags ?? {},
      };
      this.series.set(name, series);
    }

    series.points.push(point);
    // Update aggregations immediately
    this.updateSeriesAggregations(series);

    if (
      this.config.enableAlerts === true ||
      this.config.enableAlerting === true
    ) {
      this.checkAlerts(name, actualValue, actualTags);
    }

    this.emit('metricCollected', { name, point });
  }

  private updateSeriesAggregations(series: MetricSeries): void {
    const values = series.points.map((p) => p.value);
    const sorted = [...values].sort((a, b) => a - b);

    series.aggregations = {
      count: values.length,
      sum: values.reduce((a, b) => a + b, 0),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      latest: values[values.length - 1],
      p50: this.getPercentile(sorted, 0.5),
      p95: this.getPercentile(sorted, 0.95),
      p99: this.getPercentile(sorted, 0.99),
    };
  }

  private getPercentile(sorted: number[], percentile: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  private checkAlerts(
    metric: string,
    value: number,
    tags?: Record<string, string>
  ): void {
    for (const rule of this.alertRules) {
      if (
        rule.metric === metric &&
        typeof rule.condition === 'string' &&
        rule.condition !== '' &&
        this.evaluateCondition(rule.condition, value)
      ) {
        const alert: import('./types').MetricAlert = {
          id: `${rule.id}-${Date.now()}`,
          ruleId: rule.id,
          timestamp: Date.now(),
          severity: rule.severity,
          metric,
          value,
          condition: rule.condition,
          message: rule.message,
          tags: tags ?? {},
        };

        this.alerts.push(alert);
        if (this.alerts.length > 1000) {
          this.alerts = this.alerts.slice(-1000);
        }

        this.emit('alertTriggered', { alert });
      }
    }
  }

  private evaluateCondition(condition: string, value: number): boolean {
    try {
      // Safe evaluation of simple conditions
      const match = condition.match(/value\s*([><=!]+)\s*([\d.]+)/);
      if (!match) return false;

      const [, operator, threshold] = match;
      const thresholdValue = parseFloat(threshold);

      switch (operator) {
        case '>':
          return value > thresholdValue;
        case '<':
          return value < thresholdValue;
        case '>=':
          return value >= thresholdValue;
        case '<=':
          return value <= thresholdValue;
        case '==':
          return value === thresholdValue;
        case '!=':
          return value !== thresholdValue;
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  private startCollection(): void {
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.config.flushInterval);

    this.aggregationTimer = setInterval(() => {
      this.performAggregation();
    }, this.config.aggregationInterval);

    this.emit('collectionStarted');
  }

  public collect(
    name: string,
    valueOrCollector: number | (() => number | Promise<number>),
    tags?: Record<string, string>
  ): void {
    if (typeof valueOrCollector === 'number') {
      this.record(name, valueOrCollector, tags);
    } else {
      const collectData = async (): Promise<void> => {
        try {
          const value = await valueOrCollector();
          this.record(name, value, tags);
        } catch (error) {
          this.emit('collectionError', { name, error });
        }
      };
      collectData();
    }
  }

  private flushBuffer(): void {
    const flushed = this.buffer.flush();
    for (const [name, points] of flushed) {
      this.processFlushedPoints(name, points);
    }
    this.emit('bufferFlushed', { pointsCount: flushed.size });
  }

  private processFlushedPoints(name: string, points: MetricPoint[]): void {
    if (points.length === 0) return;

    const aggregations = this.aggregator.calculateAggregations(points);
    const series: MetricSeries = {
      name,
      points,
      aggregations,
      tags: this.extractCommonTags(points),
    };

    this.buffer.updateSeries(name, series);
  }

  private extractCommonTags(points: MetricPoint[]): Record<string, string> {
    if (points.length === 0) return {};

    const firstTags = points[0].tags ?? {};
    const commonTags: Record<string, string> = {};

    for (const [key, value] of Object.entries(firstTags)) {
      if (points.every((p) => p.tags?.[key] === value)) {
        commonTags[key] = value;
      }
    }

    return commonTags;
  }

  private performAggregation(): void {
    const allSeries = this.buffer.getAllSeries();
    for (const [name, series] of allSeries) {
      const updatedAggregations = this.aggregator.calculateAggregations(
        series.points
      );
      this.buffer.updateSeries(name, {
        ...series,
        aggregations: updatedAggregations,
      });
    }
    this.emit('aggregationPerformed', { seriesCount: allSeries.size });
  }

  public query(query: MetricQuery): MetricSeries[] {
    let results = Array.from(this.series.values());

    // Filter by name
    if (typeof query.name === 'string' && query.name !== '') {
      const name = query.name;
      results = results.filter((s) => s.name.includes(name));
    }

    // Filter by tags
    if (query.tags) {
      const tags = query.tags;
      results = results.filter((s) => {
        for (const [key, value] of Object.entries(tags)) {
          if (s.tags[key] !== value) return false;
        }
        return true;
      });
    }

    // Filter by time range
    if (query.timeRange) {
      const timeRange = query.timeRange;
      results = results
        .map((s) => ({
          ...s,
          points: s.points.filter(
            (p) =>
              p.timestamp >= timeRange.start && p.timestamp <= timeRange.end
          ),
        }))
        .filter((s) => s.points.length > 0);
    }

    // Apply limit to points
    if (typeof query.limit === 'number' && query.limit > 0) {
      const limit = query.limit;
      results = results.map((s) => ({
        ...s,
        points: s.points.slice(-limit),
      }));
    }

    return results;
  }

  public generateReport(timeRange?: {
    start: number;
    end: number;
  }): MetricsReport {
    const now = Date.now();
    const range = timeRange ?? {
      start: this.collectionStartTime,
      end: now,
    };

    return {
      generatedAt: now,
      timeRange: range,
      summary: this.createSummary(this.series),
      series: Array.from(this.series.values()),
      alerts: this.alerts,
      recommendations: this.generateRecommendations(),
      performance: this.getCollectorMetrics(),
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Check for high variance metrics
    for (const series of this.series.values()) {
      if (series.aggregations.count > 5) {
        const variance = series.aggregations.max - series.aggregations.min;
        const avgRange = series.aggregations.avg * 0.5;
        if (variance > avgRange) {
          recommendations.push(`High variance detected in ${series.name}`);
        }
      }
    }

    return recommendations;
  }

  private createSummary(allSeries: Map<string, MetricSeries>) {
    const totalPoints = Array.from(allSeries.values()).reduce(
      (sum, series) => sum + series.points.length,
      0
    );

    return {
      totalMetrics: this.totalPointsCollected,
      totalPoints,
      uniqueSeries: allSeries.size,
      sampleRate: this.config.sampleRate,
    };
  }

  public getCollectorMetrics(): CollectorMetrics {
    const uptime = Date.now() - this.collectionStartTime;
    const processedPerSecond =
      uptime > 0 ? (this.totalPointsCollected / uptime) * 1000 : 0;
    const allPoints = Array.from(this.series.values()).reduce(
      (sum, s) => sum + s.points.length,
      0
    );

    return {
      totalCollected: this.totalPointsCollected,
      totalPointsCollected: this.totalPointsCollected,
      totalSeries: this.series.size,
      totalPoints: allPoints,
      bufferSize: this.buffer.getBufferSize(),
      memoryUsage: process.memoryUsage().heapUsed,
      processedPerSecond,
      collectionRate: processedPerSecond,
      errorsCount: 0,
      uptime,
    };
  }

  public stop(): void {
    this.isRunning = false;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }
    this.emit('collectionStopped');
  }

  public reset(): void {
    this.stop();
    this.buffer.clear();
    this.series.clear();
    this.alerts = [];
    this.totalPointsCollected = 0;
    this.collectionStartTime = Date.now();
    this.emit('reset');
  }

  public on(event: string, handler: (...args: unknown[]) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: (...args: unknown[]) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in metrics collector event handler:`, error);
        }
      });
    }
  }

  // Legacy API compatibility methods
  public getConfig(): MetricsCollectorConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<MetricsCollectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public destroy(): void {
    this.stop();
    this.reset();
  }

  public getMetrics(): CollectorMetrics & {
    totalSeries: number;
    totalPoints: number;
    totalPointsCollected: number;
    collectionRate: number;
  } {
    return this.getCollectorMetrics() as CollectorMetrics & {
      totalSeries: number;
      totalPoints: number;
      totalPointsCollected: number;
      collectionRate: number;
    };
  }

  public getSeries(name?: string): MetricSeries[] {
    if (typeof name === 'string' && name !== '') {
      const series = this.series.get(name);
      return series ? [series] : [];
    }
    return Array.from(this.series.values());
  }

  public getAlerts(severity?: string): import('./types').MetricAlert[] {
    if (typeof severity === 'string' && severity !== '') {
      return this.alerts.filter((a) => a.severity === severity);
    }
    return [...this.alerts];
  }

  public addAlertRule(rule: import('./types').AlertRule): void {
    this.alertRules.push(rule);
  }

  public getAlertRules(): import('./types').AlertRule[] {
    return [...this.alertRules];
  }

  public removeAlertRule(id: string): boolean {
    const index = this.alertRules.findIndex((r) => r.id === id);
    if (index >= 0) {
      this.alertRules.splice(index, 1);
      return true;
    }
    return false;
  }

  public clearAlerts(): void {
    this.alerts = [];
  }

  public clearBuffer(): void {
    this.buffer.clear();
  }

  public clearSeries(): void {
    this.series.clear();
  }

  public clearAll(): void {
    this.reset();
  }
}
