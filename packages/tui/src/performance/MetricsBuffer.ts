import { CircularBuffer } from './CircularBuffer';
import type { CircularBufferConfig } from './CircularBuffer';

export class MetricsBuffer extends CircularBuffer<{
  id: string;
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
}> {
  constructor(
    config?: Partial<
      CircularBufferConfig<{
        id: string;
        name: string;
        value: number;
        timestamp: number;
        tags?: Record<string, string>;
        metadata?: Record<string, unknown>;
      }>
    >
  ) {
    super({
      capacity: 10000,
      maxAge: 300000, // 5 minutes
      cleanupInterval: 60000, // 1 minute
      ...config,
    });
  }

  public getMetricsByName(name: string): Array<{
    id: string;
    name: string;
    value: number;
    timestamp: number;
    tags?: Record<string, string>;
    metadata?: Record<string, unknown>;
  }> {
    return this.filter((metric) => metric.name === name);
  }

  public getMetrics(): Array<{
    id: string;
    name: string;
    value: number;
    timestamp: number;
    tags?: Record<string, string>;
    metadata?: Record<string, unknown>;
  }> {
    return this.toArray();
  }

  public getMetricsSince(timestamp: number): Array<{
    id: string;
    name: string;
    value: number;
    timestamp: number;
    tags?: Record<string, string>;
    metadata?: Record<string, unknown>;
  }> {
    return this.filter((metric) => metric.timestamp >= timestamp);
  }

  public getAverageValue(name: string): number {
    const metrics = this.getMetricsByName(name);
    if (metrics.length === 0) return 0;

    const sum = metrics.reduce((acc, metric) => acc + metric.value, 0);
    return sum / metrics.length;
  }

  public getMaxValue(name: string): number {
    const metrics = this.getMetricsByName(name);
    if (metrics.length === 0) return 0;

    return Math.max(...metrics.map((metric) => metric.value));
  }

  public getMinValue(name: string): number {
    const metrics = this.getMetricsByName(name);
    if (metrics.length === 0) return 0;

    return Math.min(...metrics.map((metric) => metric.value));
  }
}
