export interface MetricPoint {
  timestamp: number;
  value: number;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface AlertRule {
  id: string;
  metricName: string;
  condition: 'greater_than' | 'less_than' | 'equals';
  threshold: number;
  enabled: boolean;
}

export interface MetricAlert {
  id: string;
  ruleId: string;
  metricName: string;
  value: number;
  threshold: number;
  timestamp: number;
  resolved: boolean;
}

export interface MetricsCollectorConfig {
  enableCollection: boolean;
  bufferSize: number;
  flushInterval: number;
  compressionThreshold: number;
  retentionPeriod: number;
  enableAggregation: boolean;
  aggregationInterval: number;
  enableAlerts: boolean;
  exportFormat: string;
  persistMetrics: boolean;
}

export interface RecordOptions {
  name: string;
  value: number;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface ProcessMetricParams {
  name: string;
  value: number;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
}
