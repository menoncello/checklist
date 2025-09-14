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
  private eventHandlers = new Map<string, Set<Function>>();
  private flushTimer: Timer | null = null;
  private aggregationTimer: Timer | null = null;
  private collectionStartTime = Date.now();
  private totalPointsCollected = 0;
  private isRunning = false;

  constructor(config: Partial<MetricsCollectorConfig> = {}) {
    this.config = {
      bufferSize: 10000,
      flushInterval: 5000,
      aggregationInterval: 30000,
      retentionPeriod: 3600000,
      enableAlerting: true,
      maxAlerts: 100,
      sampleRate: 1.0,
      enableCompression: false,
      enableCollection: true,
      ...config,
    };

    this.buffer = new MetricsBuffer(
      this.config.bufferSize,
      this.config.retentionPeriod
    );
    this.alertManager = new AlertManager(this.config.maxAlerts);
    this.aggregator = new MetricsAggregator();
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startCollection();
  }

  public recordMetric(
    name: string,
    value: number,
    tags?: Record<string, string>,
    metadata?: Record<string, unknown>
  ): void {
    this.record({ name, value, tags, metadata });
  }

  public record({
    name,
    value,
    tags,
    metadata,
  }: {
    name: string;
    value: number;
    tags?: Record<string, string>;
    metadata?: Record<string, unknown>;
  }): void {
    if (!this.shouldSample()) return;

    const point: MetricPoint = {
      timestamp: Date.now(),
      value,
      tags: tags ?? {},
      metadata: { ...metadata, metric: name },
    };

    this.buffer.addPoint(name, point);
    this.totalPointsCollected++;

    if (this.config.enableAlerting) {
      this.alertManager.checkAlerts(point);
    }

    this.emit('metricRecorded', { name, point });
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
    collector: () => number | Promise<number>
  ): void {
    const collectData = async (): Promise<void> => {
      try {
        const value = await collector();
        this.recordMetric(name, value);
      } catch (error) {
        this.emit('collectionError', { name, error });
      }
    };

    collectData();
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
      if (points.every(p => p.tags?.[key] === value)) {
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
      this.buffer.updateSeries(name, { ...series, aggregations: updatedAggregations });
    }
    this.emit('aggregationPerformed', { seriesCount: allSeries.size });
  }

  public query(query: MetricQuery): MetricSeries[] {
    const allSeries = this.buffer.getAllSeries();
    return this.aggregator.querySeries(allSeries, query);
  }

  public generateReport(): MetricsReport {
    const allSeries = this.buffer.getAllSeries();
    const now = Date.now();

    return {
      generatedAt: now,
      timeRange: {
        start: this.collectionStartTime,
        end: now,
      },
      summary: this.createSummary(allSeries),
      series: Array.from(allSeries.values()),
      alerts: this.alertManager.getAlerts(),
      performance: this.getCollectorMetrics(),
    };
  }

  private createSummary(allSeries: Map<string, MetricSeries>) {
    const totalPoints = Array.from(allSeries.values())
      .reduce((sum, series) => sum + series.points.length, 0);

    return {
      totalMetrics: this.totalPointsCollected,
      totalPoints,
      uniqueSeries: allSeries.size,
      sampleRate: this.config.sampleRate,
    };
  }

  public getCollectorMetrics(): CollectorMetrics {
    const uptime = Date.now() - this.collectionStartTime;
    const processedPerSecond = uptime > 0 ? (this.totalPointsCollected / uptime) * 1000 : 0;

    return {
      totalCollected: this.totalPointsCollected,
      bufferSize: this.buffer.getBufferSize(),
      memoryUsage: process.memoryUsage().heapUsed,
      processedPerSecond,
      errorsCount: 0, // Would be tracked by error handling
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
    this.alertManager.clearAlerts();
    this.totalPointsCollected = 0;
    this.collectionStartTime = Date.now();
    this.emit('reset');
  }

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
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

  public getMetrics(): CollectorMetrics {
    return this.getCollectorMetrics();
  }

  public getSeries(name?: string): MetricSeries[] {
    const allSeries = this.buffer.getAllSeries();
    if (name != null && name !== '') {
      const series = allSeries.get(name);
      return series ? [series] : [];
    }
    return Array.from(allSeries.values());
  }

  public getAlerts(): import('./types').MetricAlert[] {
    return this.alertManager.getAlerts();
  }

  public addAlertRule(rule: import('./types').AlertRule): void {
    this.alertManager.addAlertRule(rule);
  }

  public getAlertRules(): import('./types').AlertRule[] {
    // AlertManager doesn't expose this, return empty array for compatibility
    return [];
  }

  public clearAlerts(): void {
    this.alertManager.clearAlerts();
  }

  public clearBuffer(): void {
    this.buffer.clear();
  }

  public clearSeries(): void {
    this.buffer.clear();
  }

  public clearAll(): void {
    this.reset();
  }
}