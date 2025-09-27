import type { MetricPoint, MetricsCollectorConfig } from './MetricsTypes';

export class MetricsAggregationProcessor {
  private config: MetricsCollectorConfig;
  private emit: (event: string, data?: unknown) => void;

  constructor(
    config: MetricsCollectorConfig,
    emit: (event: string, data?: unknown) => void
  ) {
    this.config = config;
    this.emit = emit;
  }

  performAggregation(series: Map<string, MetricPoint[]>): void {
    this.emit('aggregationCompleted', { series });
  }

  performSimpleAggregation(series: Map<string, MetricPoint[]>): void {
    this.emit('simpleAggregationCompleted', { series });
  }
}
