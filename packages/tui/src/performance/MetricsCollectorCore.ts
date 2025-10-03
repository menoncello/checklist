import { CollectionManager } from './CollectionManager';
import { MetricsAggregationProcessor } from './MetricsAggregationProcessor';
import { MetricsBufferManager } from './MetricsBufferManager';
import { MetricsCleanupManager } from './MetricsCleanupManager';
import { MetricsEventManager } from './MetricsEventManager';
import type {
  MetricAlert,
  MetricPoint,
  MetricsCollectorConfig,
  ProcessMetricParams,
  RecordOptions,
} from './MetricsTypes';
import { SeriesManager } from './SeriesManager';
import { AlertManager as MetricsAlertManager } from './metrics/AlertManager';

export class MetricsCollectorCore {
  protected config!: MetricsCollectorConfig;
  protected bufferManager!: MetricsBufferManager;
  protected collectionManager!: CollectionManager;
  protected eventManager!: MetricsEventManager;
  protected alertManager!: MetricsAlertManager;
  protected aggregationProcessor!: MetricsAggregationProcessor;
  protected cleanupManager!: MetricsCleanupManager;
  protected collectionStartTime = Date.now();
  protected totalPointsCollected = 0;
  protected aggregationTimer?: ReturnType<typeof setInterval>;
  protected seriesManager!: SeriesManager;
  protected series = new Map<string, MetricPoint[]>();

  constructor(config: Partial<MetricsCollectorConfig> = {}) {
    this.initializeConfig(config);
    this.initializeManagers();
    this.initializeCollectionManager();

    if (this.config.enableCollection === true) {
      this.startCollection();
    }
  }

  private initializeConfig(config: Partial<MetricsCollectorConfig>): void {
    this.config = {
      enableCollection: true,
      bufferSize: 10000,
      flushInterval: 5000,
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
    this.bufferManager = new MetricsBufferManager(this.config, () => {});
    this.alertManager = new MetricsAlertManager(100);
    this.aggregationProcessor = new MetricsAggregationProcessor(
      this.config,
      () => {}
    );
    this.cleanupManager = new MetricsCleanupManager(this.config, () => {});
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

  private startCollection(): void {
    this.bufferManager.startPeriodicFlush();
    this.cleanupManager.startPeriodicCleanup();

    if (this.config.enableAggregation === true) {
      this.aggregationTimer = setInterval(() => {
        this.performAggregation();
      }, this.config.aggregationInterval);
    }
  }

  public record(params: RecordOptions | ProcessMetricParams): void {
    if ('name' in params && 'value' in params) {
      // RecordOptions or ProcessMetricParams - both have same interface
      this.processMetric(params as ProcessMetricParams);
    }
  }

  private processMetric(params: ProcessMetricParams): void {
    const point = this.createMetricPoint(
      params.value,
      params.tags,
      params.metadata
    );
    this.bufferManager.addPoint(params.name, point);
    this.seriesManager.updateLocalSeries(params.name, point);
    this.processPoint(params.name, point);
  }

  private shouldFlush(): boolean {
    return this.totalPointsCollected % 1000 === 0;
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

    this.alertManager.checkAlerts(point);

    if (this.bufferManager.shouldFlush(name) === true) {
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
    const _cleanedPoints = this.cleanupManager.performCleanup(
      this.bufferManager.getSeries()
    );
    const _cutoff = this.cleanupManager.getCutoffTime();
    // this.alertManager.cleanupOldAlerts(cutoff); // Method not available, cleanup handled automatically
  }

  public addAlertRule(rule: MetricAlert): void {
    // Add alert rule implementation
    if (
      'addRule' in this.alertManager &&
      typeof this.alertManager.addRule === 'function'
    ) {
      this.alertManager.addRule(rule);
    }
  }

  public removeAlertRule(id: string): boolean {
    // Remove alert rule implementation
    if (
      'removeRule' in this.alertManager &&
      typeof this.alertManager.removeRule === 'function'
    ) {
      return this.alertManager.removeRule(id);
    }
    return false;
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
    if (this.aggregationTimer != null) {
      clearInterval(this.aggregationTimer);
    }
    this.flush();
  }

  public reset(): void {
    this.series.clear();
    this.totalPointsCollected = 0;
    this.collectionStartTime = Date.now();
  }

  public clearAlerts(): void {
    // Clear alerts implementation
  }

  public on(event: string, handler: (...args: unknown[]) => void): void {
    this.eventManager.on(event, handler);
  }

  public off(event: string, handler?: (...args: unknown[]) => void): void {
    if (handler) {
      this.eventManager.off(event, handler);
    }
  }

  public getConfig(): MetricsCollectorConfig {
    return { ...this.config };
  }

  public getAlerts(): MetricAlert[] {
    const alerts = this.alertManager.getAlerts();
    return alerts.map((alert) => ({
      ...alert,
      metricName: alert.metric || '',
      resolved: false, // Default to false since MetricAlert doesn't have resolved property
    })) as MetricAlert[];
  }
}
