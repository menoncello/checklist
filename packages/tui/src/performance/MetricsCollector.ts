// Re-export all types and classes from the modular implementation
export { MetricsCollector } from './metrics/MetricsCollector';
export type {
  MetricPoint,
  MetricSeries,
  MetricQuery,
  MetricsReport,
  MetricAlert,
  MetricsCollectorConfig,
  AlertRule,
  CollectorMetrics,
} from './metrics/types';
