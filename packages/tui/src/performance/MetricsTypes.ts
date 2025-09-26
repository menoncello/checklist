export interface MetricPoint {
  timestamp: number;
  value: number;
  metadata?: Record<string, unknown>;
}

export interface AlertRule {
  name: string;
  threshold: number;
  condition: 'above' | 'below' | 'equal';
  enabled: boolean;
}

export interface MetricAlert {
  rule: AlertRule;
  triggeredAt: number;
  value: number;
  resolved: boolean;
}

export interface MetricsCollectorConfig {
  enableCollection?: boolean;
  bufferSize?: number;
  aggregationInterval?: number;
  retentionPeriod?: number;
  enableAlerts?: boolean;
}

export interface ProcessMetricParams {
  name: string;
  value: number;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface RecordOptions {
  aggregate?: boolean;
  alert?: boolean;
  metadata?: Record<string, unknown>;
}
