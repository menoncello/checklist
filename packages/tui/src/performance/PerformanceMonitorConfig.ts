export interface PerformanceMonitorConfig {
  enableMetrics: boolean;
  enableBenchmarks: boolean;
  enableAlerts: boolean;
  metricsBufferSize: number;
  benchmarksBufferSize: number;
  alertsBufferSize: number;
  samplingInterval: number;
  enableAutoSampling: boolean;
  enableMemoryProfiling: boolean;
  enableCPUProfiling: boolean;
}

export const defaultPerformanceMonitorConfig: PerformanceMonitorConfig = {
  enableMetrics: true,
  enableBenchmarks: true,
  enableAlerts: true,
  metricsBufferSize: 1000,
  benchmarksBufferSize: 500,
  alertsBufferSize: 100,
  samplingInterval: 5000,
  enableAutoSampling: true,
  enableMemoryProfiling: true,
  enableCPUProfiling: false,
};
