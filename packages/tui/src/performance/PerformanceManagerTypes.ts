export interface PerformanceManagerConfig {
  enableMonitoring?: boolean;
  startupProfiling?: boolean;
  enableMemoryTracking?: boolean;
  enableMetricsCollection?: boolean;
  reportingInterval?: number;
  alertsEnabled?: boolean;
  enableStartupProfiling?: boolean;
}

export interface PerformanceReport {
  timestamp: number;
  metrics: Record<string, unknown>;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  benchmarks: Record<string, unknown>;
  alerts: unknown[];
}
