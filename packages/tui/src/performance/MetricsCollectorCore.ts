import { CollectionManager } from './CollectionManager';
import { MetricsAggregationProcessor } from './MetricsAggregationProcessor';
import { MetricsAlertManager } from './MetricsAlertManager';
import { MetricsBufferManager } from './MetricsBufferManager';
import { MetricsCleanupManager } from './MetricsCleanupManager';
import { MetricsEventManager } from './MetricsEventManager';
import type {
  AlertRule,
  MetricAlert,
  MetricPoint,
  MetricsCollectorConfig,
  ProcessMetricParams,
  RecordOptions,
} from './MetricsTypes';
import { SeriesManager } from './SeriesManager';

export class MetricsCollectorCore {
  protected config: MetricsCollectorConfig;
  protected bufferManager: MetricsBufferManager;
  protected collectionManager: CollectionManager;
  protected eventManager: MetricsEventManager;
  protected alertManager: MetricsAlertManager;
  protected aggregationProcessor: MetricsAggregationProcessor;
  protected cleanupManager: MetricsCleanupManager;
  protected collectionStartTime = Date.now();
  protected totalPointsCollected = 0;
  protected aggregationTimer?: Timer;
  protected seriesManager: SeriesManager;
  protected series = new Map<string, MetricPoint[]>();

  constructor(config: Partial<MetricsCollectorConfig> = {}) {
    this.initializeConfig(config);
    this.initializeManagers();
    this.initializeCollectionManager();

    if (this.config.enableCollection) {
      this.startCollection();
    }
  }

  private initializeConfig(config: Partial<MetricsCollectorConfig>): void {
    this.config = {
      enableCollection: true,
      bufferSize: 10000,
      flushInterval: 30000,
      compressionThreshold: 1000,
      retentionPeriod: 24 * 60 * 60 * 1000,
      enableAggregation: true,
      aggregationInterval: 60000,
      enableAlerts: true,
      exportFormat: 'json',
      persistMetrics: false,
      ...config,
    };
  }

  private initializeManagers(): void {
    this.eventManager = new MetricsEventManager();
    const emitBound = this.eventManager.emit.bind(this.eventManager);

    this.bufferManager = new MetricsBufferManager(this.config, emitBound);
    this.alertManager = new MetricsAlertManager(this.config, emitBound);
    this.aggregationProcessor = new MetricsAggregationProcessor(
      this.config,
      emitBound
    );
    this.cleanupManager = new MetricsCleanupManager(this.config, emitBound);
    this.seriesManager = new SeriesManager(this.config);
  }

  private initializeCollectionManager(): void {
    this.collectionManager = new CollectionManager({
      config: this.config,
      flushCallback: () => this.flush(),
      aggregationCallback: () => this.aggregate(),
      cleanupCallback: () => this.cleanup(),
    });
  }

  public start(): void {
    this.startCollection();
  }

  public record(options: RecordOptions): void {
    const { name, value, tags = {}, metadata } = options;
    const point: MetricPoint = {
      timestamp: Date.now(),
      value,
      tags,
      metadata,
    };

    this.bufferManager.addPoint(name, point);
    this.seriesManager.updateLocalSeries(name, point);
    this.processPoint(name, point);
  }

  protected startCollection(): void {
    this.bufferManager.startPeriodicFlush();
    this.cleanupManager.startPeriodicCleanup();

    if (this.config.enableAggregation) {
      this.aggregationTimer = setInterval(() => {
        this.performAggregation();
      }, this.config.aggregationInterval);
    }
  }

  protected processMetric(params: ProcessMetricParams): void {
    const point = this.createMetricPoint(
      params.value,
      params.tags,
      params.metadata
    );
    this.bufferManager.addPoint(params.name, point);
    this.seriesManager.updateLocalSeries(params.name, point);
    this.processPoint(params.name, point);
  }

  protected createMetricPoint(
    value: number,
    tags?: Record<string, string>,
    metadata?: Record<string, unknown>
  ): MetricPoint {
    return {
      timestamp: Date.now(),
      value,
      tags,
      metadata,
    };
  }

  protected processPoint(name: string, point: MetricPoint): void {
    this.totalPointsCollected++;

    this.alertManager.checkAlerts(name, point);

    if (this.bufferManager.shouldFlush(name)) {
      this.bufferManager.flushBuffer();
    }

    this.eventManager.emit('metricCollected', { name, point });
  }

  protected performAggregation(): void {
    this.aggregationProcessor.performAggregation(
      this.bufferManager.getSeries()
    );
  }

  protected cleanup(): void {
    const cleanedPoints = this.cleanupManager.performCleanup(
      this.bufferManager.getSeries()
    );
    const cutoff = this.cleanupManager.getCutoffTime();
    this.alertManager.cleanupOldAlerts(cutoff);
  }

  public addAlertRule(rule: AlertRule): void {
    this.alertManager.addAlertRule(rule);
  }

  public removeAlertRule(id: string): boolean {
    return this.alertManager.removeAlertRule(id);
  }

  protected flush(): void {
    this.bufferManager.flush();
  }

  protected aggregate(): void {
    this.aggregationProcessor.performSimpleAggregation(this.series);
  }

  public destroy(): void {
    this.collectionManager.destroy();
    this.bufferManager.cleanup();
    this.cleanupManager.cleanup();
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
    }
    this.clearAll();
    this.eventManager.clear();
  }

  public clearAll(): void {
    this.bufferManager.clear();
    this.alertManager.clearAlerts();
    this.totalPointsCollected = 0;
    this.collectionStartTime = Date.now();
  }

  public clearAlerts(): void {
    this.alertManager.clearAlerts();
  }

  public on(event: string, handler: Function): void {
    this.eventManager.on(event, handler);
  }

  public off(event: string, handler?: Function): void {
    this.eventManager.off(event, handler);
  }

  public emit(event: string, data?: unknown): void {
    this.eventManager.emit(event, data);
  }

  public getAlerts(): MetricAlert[] {
    return this.alertManager.getAlerts();
  }

  public getConfig(): MetricsCollectorConfig {
    return { ...this.config };
  }
}
