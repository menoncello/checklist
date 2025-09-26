import { CollectionManager } from './CollectionManager';
import { MetricsAggregationProcessor } from './MetricsAggregationProcessor';
import { MetricsAlertManager } from './MetricsAlertManager';
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
  protected aggregationTimer?: Timer;
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
      retentionPeriod: 24 * 60 * 60 * 1000,
      aggregationInterval: 60000,
      enableAlerts: true,
      ...config,
    };
  }

  private initializeManagers(): void {
    this.eventManager = new MetricsEventManager();
    this.bufferManager = new MetricsBufferManager();
    this.alertManager = new MetricsAlertManager();
    this.aggregationProcessor = new MetricsAggregationProcessor();
    this.cleanupManager = new MetricsCleanupManager();
    this.seriesManager = new SeriesManager();
  }

  private initializeCollectionManager(): void {
    this.collectionManager = new CollectionManager();
  }

  private startCollection(): void {
    this.startAggregationTimer();
  }

  public record(params: RecordOptions | ProcessMetricParams): void {
    if ('name' in params && 'value' in params) {
      // RecordOptions
      const point: MetricPoint = {
        timestamp: Date.now(),
        value: params.value,
      };

      const seriesKey = params.name;
      if (!this.series.has(seriesKey)) {
        this.series.set(seriesKey, []);
      }
      this.series.get(seriesKey)?.push(point);
      this.totalPointsCollected++;
    } else {
      // ProcessMetricParams
      this.processMetric(params as ProcessMetricParams);
    }
  }

  private processMetric(params: ProcessMetricParams): void {
    const point: MetricPoint = {
      timestamp: params.timestamp ?? Date.now(),
      value: params.value,
    };

    const seriesKey = params.name;
    if (!this.series.has(seriesKey)) {
      this.series.set(seriesKey, []);
    }
    this.series.get(seriesKey)?.push(point);
    this.totalPointsCollected++;

    // Check alerts if threshold is defined
    // this.alertManager.checkAlerts(params.value, threshold);

    if (this.shouldFlush()) {
      this.flush();
    }
  }

  private createMetricPoint(
    value: number,
    tags?: Record<string, string>
  ): MetricPoint {
    const basePoint: MetricPoint = {
      timestamp: Date.now(),
      value,
    };

    // Store tags separately if needed
    if (tags) {
      // Handle tags as needed by the application
    }

    return basePoint;
  }

  private shouldFlush(): boolean {
    return this.totalPointsCollected % 1000 === 0;
  }

  private startAggregationTimer(): void {
    this.aggregationTimer = setInterval(() => {
      this.performAggregation();
    }, this.config.aggregationInterval ?? 60000);
  }

  private performAggregation(): void {
    // Simple aggregation logic
    for (const [key, points] of this.series) {
      if (points.length > 100) {
        // Keep only recent points
        this.series.set(key, points.slice(-100));
      }
    }
  }

  public addAlertRule(
    name: string,
    threshold: number,
    condition: 'above' | 'below'
  ): void {
    this.alertManager.addAlert({
      id: `${name}-${Date.now()}`,
      metricName: name,
      condition,
      threshold,
      triggered: false,
      lastChecked: Date.now(),
    });
  }

  public removeAlertRule(_name: string): void {
    // Alert removal would be implemented here
  }

  public flush(): void {
    // Flush logic
    this.eventManager.emit('flush', { count: this.totalPointsCollected });
  }

  public getAggregatedMetrics(): Map<string, MetricPoint[]> {
    return this.series;
  }

  public stop(): void {
    if (this.aggregationTimer) {
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
    return this.alertManager.getAlerts() as MetricAlert[];
  }
}
