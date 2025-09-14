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
  recommendations?: string[];
  performance: CollectorMetrics;
}

export interface MetricAlert {
  id: string;
  ruleId?: string;
  timestamp: number;
  severity:
    | 'low'
    | 'medium'
    | 'high'
    | 'critical'
    | 'warning'
    | 'error'
    | 'info';
  metric: string;
  value: number;
  threshold?: number;
  condition?: string;
  message: string;
  tags: Record<string, string>;
}

export interface MetricsCollectorConfig {
  bufferSize: number;
  flushInterval: number;
  aggregationInterval: number;
  retentionPeriod: number;
  enableAlerting: boolean;
  enableAlerts?: boolean;
  maxAlerts: number;
  sampleRate: number;
  enableCompression: boolean;
  compressionThreshold?: number;
  enableCollection?: boolean;
  enableAggregation?: boolean;
  exportFormat?: string;
  persistMetrics?: boolean;
}

export interface AlertRule {
  id: string;
  metric: string;
  threshold?: number;
  condition?: string;
  operator?: '>' | '<' | '>=' | '<=' | '==' | '!=';
  severity:
    | 'low'
    | 'medium'
    | 'high'
    | 'critical'
    | 'warning'
    | 'error'
    | 'info';
  message: string;
  tags?: Record<string, string>;
}

export interface CollectorMetrics {
  totalCollected: number;
  totalPointsCollected?: number;
  totalSeries?: number;
  totalPoints?: number;
  bufferSize: number;
  memoryUsage: number;
  processedPerSecond: number;
  collectionRate?: number;
  errorsCount: number;
  uptime: number;
}
