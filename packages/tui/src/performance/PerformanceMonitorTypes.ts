import type { DataSanitizer } from './DataSanitizer';
import type { MetricsBuffer } from './MetricsBuffer';
import type { PerformanceCircuitBreaker } from './PerformanceCircuitBreaker';
import type { PerformanceMonitorAdvanced } from './PerformanceMonitorAdvanced';
import type { PerformanceMonitorAsync } from './PerformanceMonitorAsync';
import type { PerformanceMonitorCommands } from './PerformanceMonitorCommands';
import type { PerformanceMonitorConfig } from './PerformanceMonitorConfig';
import type { PerformanceMonitorConfigManager } from './PerformanceMonitorConfigManager';
import type { PerformanceMonitorCore } from './PerformanceMonitorCore';
import type { PerformanceMonitorDelegations } from './PerformanceMonitorDelegations';
import type { PerformanceMonitorEventManagerWrapper } from './PerformanceMonitorEventManager';
import type { PerformanceMonitorHelpers } from './PerformanceMonitorHelpers';
import type { PerformanceMonitorLifecycle } from './PerformanceMonitorLifecycle';
import type { PerformanceMonitorMethods } from './PerformanceMonitorMethods';
import type { PerformanceMonitorOperations } from './PerformanceMonitorOperations';
import type { PerformanceMonitorReporting } from './PerformanceMonitorReporting';
import type { PerformanceMonitorSettings } from './PerformanceMonitorSettings';
import type { PerformanceMonitorSystemMetrics } from './PerformanceMonitorSystemMetrics';
import type { PerformanceAlert } from './helpers/AlertManager';
import type {
  BenchmarkFilter,
  PerformanceBenchmark,
} from './helpers/BenchmarkManager';
import type { MetricFilter, PerformanceMetric } from './helpers/MetricsTracker';
import type { PerformanceMonitorEventManager } from './helpers/PerformanceMonitorEventManager';
import type { PerformanceMonitorComponents } from './helpers/PerformanceMonitorFactory';
import type { SystemSnapshot } from './helpers/SystemProfiler';

/**
 * Internal interface for PerformanceMonitor used by helper classes
 */
export interface PerformanceMonitorInternal {
  config: PerformanceMonitorConfig;
  components: PerformanceMonitorComponents;
  eventManager: PerformanceMonitorEventManager;
  circuitBreaker: PerformanceCircuitBreaker;
  dataSanitizer: DataSanitizer;
  metricsBuffer: MetricsBuffer;
  helpers: PerformanceMonitorHelpers;
  asyncProcessor: PerformanceMonitorAsync;
  configManager: PerformanceMonitorConfigManager;
  core: PerformanceMonitorCore;
  delegations: PerformanceMonitorDelegations;
  operations: PerformanceMonitorOperations;
  advanced: PerformanceMonitorAdvanced;
  systemMetrics: PerformanceMonitorSystemMetrics;
  eventManagerWrapper: PerformanceMonitorEventManagerWrapper;
  commands: PerformanceMonitorCommands;
  reporting: PerformanceMonitorReporting;
  lifecycle: PerformanceMonitorLifecycle;
  settings: PerformanceMonitorSettings;
  methods: PerformanceMonitorMethods;

  // Methods exposed to helpers
  recordAlert(alert: PerformanceAlert): void;
  getSystemSnapshot(): SystemSnapshot;
  recordMetricValue(
    name: string,
    value: number,
    tags?: Record<string, string>,
    metadata?: Record<string, unknown>
  ): void;
  emit(event: string, data?: unknown): void;
  getMetrics(filter?: MetricFilter): PerformanceMetric[];
  getBenchmarks(filter?: BenchmarkFilter): PerformanceBenchmark[];
  getAlerts(level?: 'warning' | 'critical'): PerformanceAlert[];
}
