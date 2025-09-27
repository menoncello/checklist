import type { MetricPoint, MetricsCollectorConfig } from './MetricsTypes';

export class MetricsBufferManager {
  private config: MetricsCollectorConfig;
  private emit: (event: string, data?: unknown) => void;
  private series: Map<string, MetricPoint[]> = new Map();

  constructor(
    config: MetricsCollectorConfig,
    emit: (event: string, data?: unknown) => void
  ) {
    this.config = config;
    this.emit = emit;
  }

  addPoint(name: string, point: MetricPoint): void {
    if (!this.series.has(name)) {
      this.series.set(name, []);
    }
    const series = this.series.get(name);
    if (series != null) {
      series.push(point);
    }
  }

  shouldFlush(name: string): boolean {
    const points = this.series.get(name);
    return points ? points.length >= this.config.bufferSize : false;
  }

  flushBuffer(): void {
    this.emit('bufferFlushed', { series: this.series });
  }

  flush(): void {
    this.flushBuffer();
  }

  startPeriodicFlush(): void {
    setInterval(() => this.flush(), this.config.flushInterval);
  }

  getSeries(): Map<string, MetricPoint[]> {
    return new Map(this.series);
  }

  clear(): void {
    this.series.clear();
  }

  cleanup(): void {
    this.clear();
  }
}
