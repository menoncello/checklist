import { MetricPoint, MetricSeries } from './types';

export class MetricsBuffer {
  private buffer = new Map<string, MetricPoint[]>();
  private series = new Map<string, MetricSeries>();
  private bufferSize: number;
  private retentionPeriod: number;

  constructor(bufferSize: number = 10000, retentionPeriod: number = 3600000) {
    this.bufferSize = bufferSize;
    this.retentionPeriod = retentionPeriod;
  }

  public addPoint(name: string, point: MetricPoint): void {
    this.ensureBuffer(name);
    const buffer = this.buffer.get(name);
    if (buffer) {
      buffer.push(point);
      this.trimBuffer(name);
    }
  }

  private ensureBuffer(name: string): void {
    if (!this.buffer.has(name)) {
      this.buffer.set(name, []);
      this.series.set(name, this.createEmptySeries(name));
    }
  }

  private createEmptySeries(name: string): MetricSeries {
    return {
      name,
      points: [],
      aggregations: {
        count: 0,
        sum: 0,
        avg: 0,
        min: Number.MAX_VALUE,
        max: Number.MIN_VALUE,
        p50: 0,
        p95: 0,
        p99: 0,
        latest: 0,
      },
      tags: {},
    };
  }

  private trimBuffer(name: string): void {
    const buffer = this.buffer.get(name);
    if (buffer && buffer.length > this.bufferSize) {
      buffer.splice(0, buffer.length - this.bufferSize);
    }
  }

  public flush(): Map<string, MetricPoint[]> {
    const flushed = new Map(this.buffer);
    this.buffer.clear();
    return flushed;
  }

  public getBuffer(name: string): MetricPoint[] {
    return this.buffer.get(name) ?? [];
  }

  public getAllBuffers(): Map<string, MetricPoint[]> {
    return new Map(this.buffer);
  }

  public getSeries(name: string): MetricSeries | undefined {
    return this.series.get(name);
  }

  public getAllSeries(): Map<string, MetricSeries> {
    return new Map(this.series);
  }

  public updateSeries(name: string, series: MetricSeries): void {
    this.series.set(name, series);
  }

  public getBufferSize(): number {
    return Array.from(this.buffer.values())
      .reduce((total, points) => total + points.length, 0);
  }

  public cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.retentionPeriod;

    for (const [name, points] of this.buffer) {
      const filtered = points.filter(p => p.timestamp > cutoff);
      if (filtered.length === 0) {
        this.buffer.delete(name);
        this.series.delete(name);
      } else {
        this.buffer.set(name, filtered);
      }
    }
  }

  public getMetricNames(): string[] {
    return Array.from(this.buffer.keys());
  }

  public hasMetric(name: string): boolean {
    return this.buffer.has(name);
  }

  public clear(): void {
    this.buffer.clear();
    this.series.clear();
  }
}