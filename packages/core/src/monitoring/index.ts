export {
  PerformanceMonitorService,
  setGlobalPerformanceMonitor,
  getGlobalPerformanceMonitor,
} from './PerformanceMonitor';
export {
  Timed,
  TimedClass,
  withTiming,
  createTimedFunction,
  type TimedOptions,
} from './decorators';
export {
  PerformanceDashboard,
  createDevelopmentDashboard,
  type DashboardConfig,
} from './PerformanceDashboard';
export {
  PerformanceRegressionDetector,
  createRegressionDetector,
  type RegressionResult,
  type TrendResult,
} from './RegressionDetector';
export {
  PerformanceProfiler,
  createPerformanceProfiler,
  type PerformanceBottleneck,
  type CPUProfile,
  type MemorySnapshot,
} from './PerformanceProfiler';
export { HealthMonitor } from './HealthMonitor';
