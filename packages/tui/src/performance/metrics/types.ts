export interface MetricPoint {
  timestamp: number;
  value: number;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface MetricSeries {
  name: string;
  points: MetricPoint[];
  aggregations: {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
    latest: number;
  };
  tags: Record<string, string>;
}

export interface MetricQuery {
  name?: string;
  tags?: Record<string, string>;
  timeRange?: {
    start: number;
    end: number;
  };
  aggregateBy?: 'time' | 'tags';
  aggregateInterval?: number;
  limit?: number;
}

export interface MetricsReport {
  generatedAt: number;
  timeRange: {
    start: number;
    end: number;
  };
  summary: {
    totalMetrics: number;
    totalPoints: number;
    uniqueSeries: number;
    sampleRate: number;
  };
  series: MetricSeries[];
  alerts: MetricAlert[];
  performance: CollectorMetrics;
}

export interface MetricAlert {
  id: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  message: string;
  tags: Record<string, string>;
}

export interface MetricsCollectorConfig {
  bufferSize: number;
  flushInterval: number;
  aggregationInterval: number;
  retentionPeriod: number;
  enableAlerting: boolean;
  maxAlerts: number;
  sampleRate: number;
  enableCompression: boolean;
  enableCollection?: boolean;
}

export interface AlertRule {
  metric: string;
  threshold: number;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  tags?: Record<string, string>;
}

export interface CollectorMetrics {
  totalCollected: number;
  bufferSize: number;
  memoryUsage: number;
  processedPerSecond: number;
  errorsCount: number;
  uptime: number;
}