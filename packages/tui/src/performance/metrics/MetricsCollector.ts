import { AlertManager } from './AlertManager';
import { MetricsAggregator } from './MetricsAggregator';
import { MetricsBuffer } from './MetricsBuffer';
import { MetricsQueryEngine } from './MetricsQueryEngine';
import { MetricsRecorder } from './MetricsRecorder';
import { MetricsReportGenerator } from './MetricsReportGenerator';
import { MetricsSeriesManager } from './MetricsSeriesManager';
import {
  MetricPoint,
  MetricSeries,
  MetricQuery,
  MetricsReport,
  MetricsCollectorConfig,
  CollectorMetrics,
  AlertRule,
} from './types';

export class MetricsCollector {
  private config: MetricsCollectorConfig;
  private buffer!: MetricsBuffer;
  private alertManager!: AlertManager;
  private aggregator!: MetricsAggregator;
  private recorder!: MetricsRecorder;
  private seriesManager!: MetricsSeriesManager;
  private queryEngine!: MetricsQueryEngine;
  private reportGenerator!: MetricsReportGenerator;

  private eventHandlers = new Map<string, Set<(...args: unknown[]) => void>>();
  private flushTimer: Timer | null = null;
  private aggregationTimer: Timer | null = null;
  private collectionStartTime = Date.now();
  private isRunning = false;
  private alertRules: import('./types').AlertRule[] = [];
  private alerts: import('./types').MetricAlert[] = [];

  constructor(
    config: Partial<MetricsCollectorConfig & { alertRules?: AlertRule[] }> = {}
  ) {
    this.config = this.initializeConfig(config);
    this.initializeComponents();
    this.initializeDefaultAlertRules();
    if (config.alertRules !== undefined) {
      this.alertRules = config.alertRules;
    }
  }

  private initializeConfig(
    config: Partial<MetricsCollectorConfig>
  ): MetricsCollectorConfig {
    return {
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
  }

  private initializeComponents(): void {
    this.buffer = new MetricsBuffer(
      this.config.bufferSize,
      this.config.retentionPeriod
    );
    this.alertManager = new AlertManager(this.config.maxAlerts);
    this.aggregator = new MetricsAggregator();
    this.recorder = new MetricsRecorder(this.buffer, this.config.sampleRate);
    this.seriesManager = new MetricsSeriesManager();
    this.queryEngine = new MetricsQueryEngine();
    this.reportGenerator = new MetricsReportGenerator(
      this.collectionStartTime,
      0
    );
  }

  private initializeDefaultAlertRules(): void {
    this.alertRules = [
      this.createMemoryAlertRule(),
      this.createCpuAlertRule(),
      this.createResponseTimeAlertRule(),
    ];
  }

  private createMemoryAlertRule(): AlertRule {
    return {
      id: 'high-memory',
      metric: 'memory_heap_used',
      threshold: 100 * 1024 * 1024,
      operator: '>',
      severity: 'high',
      message: 'High memory usage detected',
    };
  }

  private createCpuAlertRule(): AlertRule {
    return {
      id: 'high-cpu',
      metric: 'cpu_usage',
      threshold: 80,
      operator: '>',
      severity: 'high',
      message: 'High CPU usage detected',
    };
  }

  private createResponseTimeAlertRule(): AlertRule {
    return {
      id: 'slow-response',
      metric: 'response_time',
      threshold: 1000,
      operator: '>',
      severity: 'medium',
      message: 'Slow response time detected',
    };
  }

  record(
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
    if (!this.recorder.shouldRecord(this.config.enableCollection ?? true))
      return;

    const params = this.recorder.parseRecordParams(
      nameOrObj,
      value,
      tags,
      metadata
    );
    const point = this.recorder.createMetricPoint(params);

    this.recorder.recordPoint(params.name, point, (name, pt) => {
      this.seriesManager.addPointToSeries(name, pt, params.tags);
      this.processAlerts(name, pt.value, params.tags);
      this.emit('metricCollected', { name, point: pt });
    });

    this.reportGenerator.setTotalPointsCollected(
      this.recorder.getTotalPointsCollected()
    );
  }

  private processAlerts(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void {
    if (
      this.config.enableAlerts === true ||
      this.config.enableAlerting === true
    ) {
      this.checkAlerts(name, value, tags);
    }
  }

  on(event: string, handler: (...args: unknown[]) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)?.add(handler);
  }

  off(event: string, handler: (...args: unknown[]) => void): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (_error) {
          // Don't let handler errors propagate but log them if needed
          if (event !== 'error' && event !== 'collectionError') {
            // Could log error here if we had a logger
          }
        }
      });
    }
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.collectionStartTime = Date.now();

    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.config.flushInterval);

    this.aggregationTimer = setInterval(() => {
      this.performAggregation();
    }, this.config.aggregationInterval);

    this.emit('collectionStarted');
  }

  stop(): void {
    if (!this.isRunning) return;

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
      tags: this.queryEngine.extractCommonTags(points),
    };

    this.buffer.updateSeries(name, series);
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

  collect(
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

  query(query: MetricQuery): MetricSeries[] {
    return this.queryEngine.query(this.seriesManager.getSeries(), query);
  }

  generateReport(timeRange?: { start: number; end: number }): MetricsReport {
    return this.reportGenerator.generateReport(
      this.seriesManager.getSeries(),
      this.alerts,
      timeRange
    );
  }

  private checkAlerts(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void {
    for (const rule of this.alertRules) {
      if (this.matchesRule(rule, name, tags)) {
        const alert = this.createAlertFromRule(rule, name, value, tags);
        if (alert !== null && alert !== undefined) {
          this.alerts.push(alert);
          this.trimAlerts();
          this.emit('alertTriggered', { alert });
        }
      }
    }
  }

  private createAlertFromRule(
    rule: import('./types').AlertRule,
    name: string,
    value: number,
    tags?: Record<string, string>
  ): import('./types').MetricAlert | null {
    // Check if alert should trigger based on condition or operator
    let shouldTrigger = false;

    if (rule.condition !== undefined) {
      try {
        // Simple evaluation for test conditions
        shouldTrigger = this.evaluateCondition(rule.condition, value);
      } catch {
        return null;
      }
    } else if (rule.operator !== undefined && rule.threshold !== undefined) {
      shouldTrigger = this.evaluateOperator(
        value,
        rule.operator,
        rule.threshold
      );
    }

    if (!shouldTrigger) return null;

    return {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      timestamp: Date.now(),
      severity: rule.severity,
      metric: name,
      value,
      threshold: rule.threshold,
      condition: rule.condition,
      message: rule.message,
      tags: { ...rule.tags, ...tags },
    };
  }

  private evaluateCondition(condition: string, value: number): boolean {
    // Simple evaluation for common patterns
    if (condition.includes('value >')) {
      const threshold = parseFloat(condition.split('>')[1].trim());
      return value > threshold;
    }
    if (condition.includes('value <')) {
      const threshold = parseFloat(condition.split('<')[1].trim());
      return value < threshold;
    }
    if (condition.includes('value >=')) {
      const threshold = parseFloat(condition.split('>=')[1].trim());
      return value >= threshold;
    }
    if (condition.includes('value <=')) {
      const threshold = parseFloat(condition.split('<=')[1].trim());
      return value <= threshold;
    }
    if (condition.includes('value ==')) {
      const threshold = parseFloat(condition.split('==')[1].trim());
      return value === threshold;
    }
    return false;
  }

  private evaluateOperator(
    value: number,
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=',
    threshold: number
  ): boolean {
    switch (operator) {
      case '>':
        return value > threshold;
      case '<':
        return value < threshold;
      case '>=':
        return value >= threshold;
      case '<=':
        return value <= threshold;
      case '==':
        return value === threshold;
      case '!=':
        return value !== threshold;
      default:
        return false;
    }
  }

  private trimAlerts(): void {
    if (this.alerts.length > this.config.maxAlerts) {
      this.alerts = this.alerts.slice(-this.config.maxAlerts);
    }
  }

  private matchesRule(
    rule: import('./types').AlertRule,
    name: string,
    tags?: Record<string, string>
  ): boolean {
    if (rule.metric !== name) return false;

    if (rule.tags !== undefined) {
      for (const [key, value] of Object.entries(rule.tags)) {
        if (tags?.[key] !== value) return false;
      }
    }

    return true;
  }

  getCollectorMetrics(): CollectorMetrics {
    const now = Date.now();
    const metrics = this.getMetrics();
    const totalPointsCollected = this.recorder.getTotalPointsCollected();
    const uptime = now - this.collectionStartTime;

    return {
      totalCollected: totalPointsCollected,
      totalPointsCollected,
      totalSeries: metrics.totalSeries,
      totalPoints: metrics.totalPoints,
      bufferSize: metrics.bufferSize,
      memoryUsage: process.memoryUsage().heapUsed,
      processedPerSecond: totalPointsCollected / (uptime / 1000),
      collectionRate: totalPointsCollected / (uptime / 1000),
      errorsCount: 0,
      uptime,
    };
  }

  exportMetrics(): string {
    const report = this.generateReport();

    switch (this.config.exportFormat) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'prometheus':
        return this.exportAsPrometheus(report);
      case 'csv':
        return this.exportAsCSV(report);
      default:
        return JSON.stringify(report);
    }
  }

  private exportAsPrometheus(report: MetricsReport): string {
    const lines: string[] = [];

    for (const series of report.series) {
      const metricName = series.name.replace(/[^a-zA-Z0-9_]/g, '_');
      const tags = Object.entries(series.tags)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      const tagString = tags ? `{${tags}}` : '';

      if (series.points.length > 0) {
        const latest = series.points[series.points.length - 1];
        lines.push(
          `${metricName}${tagString} ${latest.value} ${latest.timestamp}`
        );
      }
    }

    return lines.join('\n');
  }

  private exportAsCSV(report: MetricsReport): string {
    const headers = ['metric', 'timestamp', 'value', 'tags'];
    const rows: string[] = [headers.join(',')];

    for (const series of report.series) {
      for (const point of series.points) {
        const tagString = JSON.stringify(point.tags ?? {});
        rows.push(
          [
            series.name,
            point.timestamp.toString(),
            point.value.toString(),
            tagString,
          ].join(',')
        );
      }
    }

    return rows.join('\n');
  }

  clear(): void {
    this.buffer.clear();
    this.seriesManager.clear();
    this.alerts = [];
    this.emit('cleared');
  }

  clearBuffer(): void {
    this.buffer.clear();
  }

  clearSeries(): void {
    this.seriesManager.clear();
  }

  clearAll(): void {
    this.clear();
    this.recorder.reset();
    // Don't reset alert rules when clearing all data
  }

  destroy(): void {
    this.stop();
    this.clear();
    this.eventHandlers.clear();
  }

  // Compatibility methods for tests
  getConfig(): MetricsCollectorConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<MetricsCollectorConfig>): void {
    this.config = { ...this.config, ...config };
    // Re-initialize components if buffer size or retention changed
    if (
      config.bufferSize !== undefined ||
      config.retentionPeriod !== undefined
    ) {
      this.initializeComponents();
    }
  }

  getMetrics(): {
    totalSeries: number;
    totalPoints: number;
    bufferSize: number;
    totalPointsCollected: number;
    uptime?: number;
    collectionRate?: number;
  } {
    const seriesMap = this.seriesManager.getSeries();
    let totalPoints = 0;
    for (const s of seriesMap.values()) {
      if (s.points != null) {
        totalPoints += s.points.length;
      }
    }
    const now = Date.now();
    const uptime = now - this.collectionStartTime;
    const totalPointsCollected = this.recorder.getTotalPointsCollected();

    return {
      totalSeries: seriesMap.size,
      totalPoints,
      bufferSize: this.buffer.getCurrentSize(),
      totalPointsCollected,
      uptime,
      collectionRate: totalPointsCollected / (uptime / 1000),
    };
  }

  recordMetric(
    name: string,
    value: number,
    metadata?: Record<string, unknown>
  ): void {
    this.record(name, value, undefined, metadata);
  }

  getAlerts(): import('./types').MetricAlert[] {
    return [...this.alerts];
  }

  clearAlerts(): void {
    this.alerts = [];
  }

  getSeries(name?: string): MetricSeries[] {
    const seriesMap = this.seriesManager.getSeries();
    const seriesArray = Array.from(seriesMap.values());
    if (name !== undefined) {
      return seriesArray.filter((s) => s.name === name);
    }
    return seriesArray;
  }

  addAlertRule(rule: import('./types').AlertRule): void {
    this.alertRules.push(rule);
  }

  getAlertRules(): import('./types').AlertRule[] {
    return [...this.alertRules];
  }

  removeAlertRule(ruleId: string): boolean {
    const index = this.alertRules.findIndex((r) => r.id === ruleId);
    if (index >= 0) {
      this.alertRules.splice(index, 1);
      return true;
    }
    return false;
  }

  getAlertsBySeverity(severity: string): import('./types').MetricAlert[] {
    return this.alerts.filter((a) => a.severity === severity);
  }
}
