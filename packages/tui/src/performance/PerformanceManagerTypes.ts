export interface PerformanceManagerConfig {
  enableMonitoring: boolean;
  enableStartupProfiling: boolean;
  enableMemoryTracking: boolean;
  enableMetricsCollection: boolean;
  reportingInterval: number;
  alertsEnabled: boolean;
  startupProfiling?: boolean;
}

export interface PerformanceReport {
  timestamp: number;
  metrics: {
    sampleRate: number;
    [key: string]: unknown;
  };
  system: {
    memory: {
      heapUsed: number;
      heapTotal: number;
      external: number;
      [key: string]: unknown;
    };
    cpu?: {
      usage: number;
      [key: string]: unknown;
    };
  };
  benchmarks?: unknown[];
  startup?: unknown;
}
