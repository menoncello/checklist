import type { MetricPoint, MetricsCollectorConfig } from './MetricsTypes';

export class SeriesManager {
  private config: MetricsCollectorConfig;
  private localSeries: Map<string, MetricPoint[]> = new Map();

  constructor(config: MetricsCollectorConfig) {
    this.config = config;
  }

  updateLocalSeries(name: string, point: MetricPoint): void {
    if (!this.localSeries.has(name)) {
      this.localSeries.set(name, []);
    }
    const series = this.localSeries.get(name);
    if (series != null) {
      series.push(point);

      // Keep only recent points to prevent memory issues
      if (series.length > this.config.bufferSize) {
        series.splice(0, series.length - this.config.bufferSize);
      }
    }
  }

  getSeries(
    name?: string
  ): Map<string, MetricPoint[]> | MetricPoint[] | undefined {
    if (name != null && name !== '') {
      return this.localSeries.get(name);
    }
    return new Map(this.localSeries);
  }

  clear(): void {
    this.localSeries.clear();
  }

  clearSeries(name: string): void {
    this.localSeries.delete(name);
  }
}
