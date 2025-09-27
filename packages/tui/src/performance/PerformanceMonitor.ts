import { DataSanitizer } from './DataSanitizer';
import { MetricsBuffer } from './MetricsBuffer';
import { PerformanceCircuitBreaker } from './PerformanceCircuitBreaker';
import { PerformanceMonitorAdvanced } from './PerformanceMonitorAdvanced';
import { PerformanceMonitorAsync } from './PerformanceMonitorAsync';
import { PerformanceMonitorCommands } from './PerformanceMonitorCommands';
import {
  defaultPerformanceMonitorConfig,
  PerformanceMonitorConfig,
} from './PerformanceMonitorConfig';
import { PerformanceMonitorConfigManager } from './PerformanceMonitorConfigManager';
import { PerformanceMonitorCore } from './PerformanceMonitorCore';
import { PerformanceMonitorDelegations } from './PerformanceMonitorDelegations';
import { PerformanceMonitorEventManagerWrapper } from './PerformanceMonitorEventManager';
import { PerformanceMonitorHelpers } from './PerformanceMonitorHelpers';
import { PerformanceMonitorLifecycle } from './PerformanceMonitorLifecycle';
import { PerformanceMonitorMethods } from './PerformanceMonitorMethods';
import { PerformanceMonitorOperations } from './PerformanceMonitorOperations';
import { PerformanceMonitorReporting } from './PerformanceMonitorReporting';
import { PerformanceMonitorSettings } from './PerformanceMonitorSettings';
import { PerformanceMonitorSystemMetrics } from './PerformanceMonitorSystemMetrics';
import { PerformanceAlert, PerformanceThreshold } from './helpers/AlertManager';
import {
  PerformanceBenchmark,
  BenchmarkFilter,
} from './helpers/BenchmarkManager';
import { PerformanceMetric, MetricFilter } from './helpers/MetricsTracker';
import { PerformanceMonitorEventManager } from './helpers/PerformanceMonitorEventManager';
import {
  PerformanceMonitorComponents,
  PerformanceMonitorFactory,
} from './helpers/PerformanceMonitorFactory';
import { SystemSnapshot } from './helpers/SystemProfiler';

export {
  BenchmarkFilter,
  MetricFilter,
  PerformanceAlert,
  PerformanceBenchmark,
  PerformanceMetric,
  PerformanceThreshold,
  SystemSnapshot,
};
export type { PerformanceMonitorConfig } from './PerformanceMonitorConfig';

export class PerformanceMonitor {
  public config!: PerformanceMonitorConfig;
  public components!: PerformanceMonitorComponents;
  public eventManager = new PerformanceMonitorEventManager();
  public circuitBreaker!: PerformanceCircuitBreaker;
  public dataSanitizer!: DataSanitizer;
  public metricsBuffer!: MetricsBuffer;
  public helpers!: PerformanceMonitorHelpers;
  public asyncProcessor!: PerformanceMonitorAsync;
  public configManager!: PerformanceMonitorConfigManager;
  public core!: PerformanceMonitorCore;
  public delegations!: PerformanceMonitorDelegations;
  public operations!: PerformanceMonitorOperations;
  public advanced!: PerformanceMonitorAdvanced;
  public systemMetrics!: PerformanceMonitorSystemMetrics;
  public eventManagerWrapper!: PerformanceMonitorEventManagerWrapper;
  public commands!: PerformanceMonitorCommands;
  public reporting!: PerformanceMonitorReporting;
  public lifecycle!: PerformanceMonitorLifecycle;
  public settings!: PerformanceMonitorSettings;
  public methods!: PerformanceMonitorMethods;

  constructor(config?: Partial<PerformanceMonitorConfig>) {
    this.initializeComponents(config);
    this.commands = new PerformanceMonitorCommands(this);
    this.reporting = new PerformanceMonitorReporting(this);
    this.lifecycle = new PerformanceMonitorLifecycle(this);
    this.settings = new PerformanceMonitorSettings(this);
    this.methods = new PerformanceMonitorMethods(this);
  }

  private initializeComponents(
    config?: Partial<PerformanceMonitorConfig>
  ): void {
    this.config = { ...defaultPerformanceMonitorConfig, ...config };
    this.initializeCore();
    this.initializeHelpers();
    this.initializeManagers();
    this.initializeProcessors();
  }

  private initializeCore(): void {
    this.dataSanitizer = new DataSanitizer();
    this.metricsBuffer = new MetricsBuffer({
      capacity: this.config.metricsBufferSize,
    });
    this.components = PerformanceMonitorFactory.createComponents(
      this.config,
      (name: string, value: number, metadata?: Record<string, unknown>) => {
        this.eventManager.emit('systemMetric', { name, value, metadata });
      }
    );
    this.circuitBreaker = new PerformanceCircuitBreaker();
  }

  private initializeHelpers(): void {
    this.helpers = new PerformanceMonitorHelpers({
      dataSanitizer: this.dataSanitizer,
      metricsBuffer: this.metricsBuffer,
      circuitBreaker: this.circuitBreaker,
      eventManager: this.eventManager,
      components: {
        performanceBudget: this.components.performanceBudget,
        alertManager: this.components.alertManager,
      },
      config: {
        enableAlerts: this.config.enableAlerts,
        enableMetrics: this.config.enableMetrics,
        enableAutoSampling: this.config.enableAutoSampling,
      },
    });
    this.delegations = new PerformanceMonitorDelegations(
      this.components,
      this.config
    );
  }

  private initializeManagers(): void {
    this.eventManagerWrapper = new PerformanceMonitorEventManagerWrapper(
      this.eventManager
    );
    this.systemMetrics = new PerformanceMonitorSystemMetrics(
      this.helpers,
      this.circuitBreaker
    );
    this.configManager = new PerformanceMonitorConfigManager(
      this.config,
      this.components,
      this.eventManager
    );
  }

  private initializeProcessors(): void {
    this.asyncProcessor = new PerformanceMonitorAsync(
      this.eventManager,
      {
        performanceBudget: { checkMetric: () => null },
        alertManager: { checkMetric: () => null },
      },
      { enableAlerts: this.config.enableAlerts }
    );
    this.core = new PerformanceMonitorCore({
      delegations: this.delegations,
      helpers: this.helpers,
      dataSanitizer: this.dataSanitizer,
      metricsBuffer: this.metricsBuffer,
      asyncProcessor: this.asyncProcessor,
    });
    this.operations = new PerformanceMonitorOperations({
      circuitBreaker: this.circuitBreaker,
      dataSanitizer: this.dataSanitizer,
      metricsBuffer: this.metricsBuffer,
      components: this.components,
      config: this.config,
      asyncProcessor: this.asyncProcessor,
    });
    this.advanced = new PerformanceMonitorAdvanced(
      this.operations,
      this.systemMetrics
    );
  }

  // Core methods - delegated to methods helper
  public mark(name: string): number {
    return this.methods.mark(name);
  }
  public measure(name: string, startMark: string, endMark: string): number {
    return this.methods.measure(name, startMark, endMark);
  }
  public recordMetricValue(
    name: string,
    value: number,
    tags?: Record<string, string>,
    metadata?: Record<string, unknown>
  ): void {
    this.methods.recordMetricValue(name, value, tags, metadata);
  }
  public recordMetric(metric: PerformanceMetric): void {
    this.methods.recordMetric(metric);
  }
  public startBenchmark(
    name: string,
    category: string = 'general',
    metadata?: Record<string, unknown>
  ): string {
    return this.methods.startBenchmark(name, category, metadata);
  }
  public endBenchmark(id: string): PerformanceBenchmark | null {
    return this.methods.endBenchmark(id);
  }
  public measureFunction<T extends (...args: unknown[]) => unknown>(
    fn: T,
    name: string,
    category: string = 'function'
  ): T {
    return this.methods.measureFunction(fn, name, category);
  }
  public async measureAsync<T>(
    promise: Promise<T>,
    name: string,
    category: string = 'async'
  ): Promise<T> {
    return this.methods.measureAsync(promise, name, category);
  }

  public recordCommandExecution(commandId: string, duration: number): void {
    this.commands.recordCommandExecution(commandId, duration);
  }
  // Configuration methods
  public updateConfig(config: Partial<PerformanceMonitorConfig>): void {
    this.settings.updateConfig(config);
  }

  public getConfig(): PerformanceMonitorConfig {
    return this.settings.getConfig();
  }

  // Alert management
  public addThreshold(threshold: PerformanceThreshold): void {
    this.settings.addThreshold(threshold);
  }

  public removeThreshold(metric: string): boolean {
    return this.settings.removeThreshold(metric);
  }

  public getAlerts(level?: 'warning' | 'critical'): PerformanceAlert[] {
    return this.settings.getAlerts(level);
  }

  // Data access
  public getMetrics(filter?: MetricFilter): PerformanceMetric[] {
    return this.reporting.getMetrics(filter);
  }

  public getBenchmarks(filter?: BenchmarkFilter): PerformanceBenchmark[] {
    return this.reporting.getBenchmarks(filter);
  }

  public getStatistics(metricName: string): {
    count: number;
    min: number;
    max: number;
    average: number;
    median: number;
    p95: number;
  } {
    return this.reporting.getStatistics(metricName);
  }
  // Report generation - delegated to both commands and reporting
  public generateReport(): {
    metrics: PerformanceMetric[];
    benchmarks: PerformanceBenchmark[];
    alerts: PerformanceAlert[];
    systemSnapshot: SystemSnapshot;
  } {
    // Use commands.generateReport for the full structure
    return this.commands.generateReport();
  }

  // Circuit breaker
  public isCircuitBreakerActive(): boolean {
    return this.lifecycle.isCircuitBreakerActive();
  }

  public resetCircuitBreaker(): void {
    this.lifecycle.resetCircuitBreaker();
  }

  // Event management
  public on(event: string, handler: Function): void {
    this.eventManagerWrapper.on(event, handler);
  }

  public off(event: string, handler: Function): void {
    this.eventManagerWrapper.off(event, handler);
  }

  public emit(event: string, data?: unknown): void {
    this.eventManagerWrapper.emit(event, data);
  }

  // Cleanup
  public clearAll(): void {
    this.lifecycle.clearAll();
  }

  public clearMetrics(): void {
    this.lifecycle.clearMetrics();
  }

  public clearBenchmarks(): void {
    this.lifecycle.clearBenchmarks();
  }

  public clearAlerts(): void {
    this.lifecycle.clearAlerts();
  }

  public destroy(): void {
    this.lifecycle.destroy();
  }

  // Private method for testing purposes
  private handleSystemMetric(
    name: string,
    value: number,
    metadata?: Record<string, unknown>
  ): void {
    this.recordMetricValue(name, value, { system: 'true' }, metadata);
  }

  // Internal helpers for commands
  public recordAlert(alert: PerformanceAlert): void {
    this.components.alertManager.recordAlert(alert);
  }

  public getSystemSnapshot(): SystemSnapshot {
    return this.components.systemProfiler.getSystemSnapshot();
  }
}
