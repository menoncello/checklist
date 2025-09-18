export interface PerformanceManagerConfig {
  enableMonitoring: boolean;
  enableMemoryTracking: boolean;
  enableMetricsCollection: boolean;
  alertsEnabled: boolean;
  reportingInterval: number;
  maxDataPoints: number;
  startupProfiling: boolean;
}

export interface PerformanceReport {
  timestamp: number;
  uptime: number;
  system: {
    memory: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
      external: number;
      arrayBuffers: number;
    };
    cpu: {
      user: number;
      system: number;
    };
    eventLoopDelay: number;
  };
  startup: unknown;
  memory: {
    current: unknown;
    trends: unknown[];
    leaks: unknown[];
  };
  metrics: {
    totalSeries: number;
    totalPoints: number;
    sampleRate: number;
  };
  alerts: {
    performance: unknown[];
    memory: unknown[];
    metrics: unknown[];
  };
  recommendations: string[];
}

export interface PerformanceSnapshot {
  timestamp: number;
  memory: NodeJS.MemoryUsage;
  cpu: NodeJS.CpuUsage;
  eventLoopDelay?: number;
  gcStats?: {
    collected: number;
    duration: number;
    type: string;
  };
}

export interface StartupProfile {
  startTime: number;
  endTime: number;
  duration: number;
  phases: Array<{
    name: string;
    startTime: number;
    endTime: number;
    duration: number;
    metadata?: Record<string, unknown>;
  }>;
  metrics: {
    timeToInteractive: number;
    initialMemory: number;
    peakMemory: number;
    moduleLoadTime: number;
  };
  bottlenecks: Array<{
    phase: string;
    duration: number;
    impact: 'low' | 'medium' | 'high';
    recommendation: string;
  }>;
}

export interface MetricsQuery {
  seriesName?: string;
  tags?: Record<string, string>;
  timeRange?: {
    start: number;
    end: number;
  };
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
  groupBy?: string[];
}

export interface AlertConfig {
  type: 'threshold' | 'anomaly' | 'pattern';
  metric: string;
  condition: {
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    value: number;
    duration?: number;
  };
  severity: 'info' | 'warning' | 'error' | 'critical';
  cooldown?: number;
}
