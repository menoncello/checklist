import { DataSanitizer } from './DataSanitizer';
import { MetricsBuffer } from './MetricsBuffer';
import { PerformanceCircuitBreaker } from './PerformanceCircuitBreaker';
import { PerformanceMonitorAdvanced } from './PerformanceMonitorAdvanced';
import { PerformanceMonitorAsync } from './PerformanceMonitorAsync';
import {
  defaultPerformanceMonitorConfig,
  PerformanceMonitorConfig,
} from './PerformanceMonitorConfig';
import { PerformanceMonitorConfigManager } from './PerformanceMonitorConfigManager';
import { PerformanceMonitorCore } from './PerformanceMonitorCore';
import { PerformanceMonitorDelegations } from './PerformanceMonitorDelegations';
import { PerformanceMonitorEventManagerWrapper } from './PerformanceMonitorEventManager';
import { PerformanceMonitorHelpers } from './PerformanceMonitorHelpers';
import { PerformanceMonitorOperations } from './PerformanceMonitorOperations';
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
import { PerformanceReport } from './helpers/ReportGenerator';
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
  private config!: PerformanceMonitorConfig;
  private components!: PerformanceMonitorComponents;
  private eventManager = new PerformanceMonitorEventManager();
  public circuitBreaker!: PerformanceCircuitBreaker;
  private dataSanitizer!: DataSanitizer;
  private metricsBuffer!: MetricsBuffer;
  private helpers!: PerformanceMonitorHelpers;
  private asyncProcessor!: PerformanceMonitorAsync;
  private configManager!: PerformanceMonitorConfigManager;
  private core!: PerformanceMonitorCore;
  private delegations!: PerformanceMonitorDelegations;
  private operations!: PerformanceMonitorOperations;
  private advanced!: PerformanceMonitorAdvanced;
  private systemMetrics!: PerformanceMonitorSystemMetrics;
  private eventManagerWrapper!: PerformanceMonitorEventManagerWrapper;

  constructor(config?: Partial<PerformanceMonitorConfig>) {
    this.initializeComponents(config);
  }

  private initializeComponents(
    config?: Partial<PerformanceMonitorConfig>
  ): void {
    this.initializeConfig(config);
    this.initializeManagers();
    this.initializeCoreComponents();
  }

  private initializeConfig(config?: Partial<PerformanceMonitorConfig>): void {
    this.config = { ...defaultPerformanceMonitorConfig, ...config };
    // Initialize configManager after components are created
  }

  private createPerformanceHelpers(): PerformanceMonitorHelpers {
    return new PerformanceMonitorHelpers({
      dataSanitizer: this.dataSanitizer,
      metricsBuffer: this.metricsBuffer,
      circuitBreaker: new PerformanceCircuitBreaker(),
      eventManager: this.eventManager,
      components: {
        performanceBudget: this.components.performanceBudget,
        alertManager: this.components.alertManager,
      },
      config: { enableAlerts: this.config.enableAlerts },
    });
  }

  private createAsyncProcessor(): PerformanceMonitorAsync {
    return new PerformanceMonitorAsync(
      this.eventManager,
      {
        performanceBudget: {
          checkMetric: () => null,
        },
        alertManager: {
          checkMetric: () => null,
        },
      },
      { enableAlerts: this.config.enableAlerts }
    );
  }

  private initializeManagers(): void {
    this.dataSanitizer = new DataSanitizer();
    this.metricsBuffer = new MetricsBuffer({
      capacity: this.config.metricsBufferSize,
    });
    // Components must be initialized before helpers
    this.components = this.createFactoryComponents();
    this.helpers = this.createPerformanceHelpers();
    this.asyncProcessor = this.createAsyncProcessor();
    this.eventManagerWrapper = new PerformanceMonitorEventManagerWrapper(
      this.eventManager
    );
    this.systemMetrics = new PerformanceMonitorSystemMetrics(
      this.helpers,
      new PerformanceCircuitBreaker()
    );
  }

  private createFactoryComponents() {
    return PerformanceMonitorFactory.createComponents(
      this.config,
      (name: string, value: number, metadata?: Record<string, unknown>) => {
        this.eventManager.emit('systemMetric', { name, value, metadata });
      }
    );
  }

  private createDelegations() {
    return new PerformanceMonitorDelegations(this.components, this.config);
  }

  private createCore() {
    return new PerformanceMonitorCore({
      delegations: this.delegations,
      helpers: this.helpers,
      dataSanitizer: this.dataSanitizer,
      metricsBuffer: this.metricsBuffer,
      asyncProcessor: this.asyncProcessor,
    });
  }

  private createOperations() {
    return new PerformanceMonitorOperations({
      circuitBreaker: this.circuitBreaker,
      dataSanitizer: this.dataSanitizer,
      metricsBuffer: this.metricsBuffer,
      components: this.components,
      config: this.config,
      asyncProcessor: this.asyncProcessor,
    });
  }

  private initializeCoreComponents(): void {
    // Components already initialized in initializeManagers()
    this.configManager = new PerformanceMonitorConfigManager(
      this.config,
      this.components,
      this.eventManager
    );
    this.delegations = this.createDelegations();
    this.core = this.createCore();
    this.operations = this.createOperations();
    this.advanced = new PerformanceMonitorAdvanced(
      this.operations,
      this.systemMetrics
    );
    this.circuitBreaker = new PerformanceCircuitBreaker();
  }

  // Core methods
  public mark(name: string): number {
    return this.core.mark(name);
  }

  public measure(name: string, startMark: string, endMark: string): number {
    return this.core.measure(name, startMark, endMark);
  }

  public recordMetricValue(
    name: string,
    value: number,
    tags?: Record<string, string>,
    metadata?: Record<string, unknown>
  ): void {
    this.core.recordMetricValue(name, value, tags, metadata);
  }

  public recordMetric(metric: PerformanceMetric): void {
    this.core.recordMetric(metric);
  }

  public startBenchmark(
    name: string,
    category: string = 'general',
    metadata?: Record<string, unknown>
  ): string {
    return this.core.startBenchmark(name, category, metadata);
  }

  public endBenchmark(id: string): PerformanceBenchmark | null {
    return this.core.endBenchmark(id);
  }

  public measureFunction<T extends (...args: unknown[]) => unknown>(
    fn: T,
    name: string,
    category: string = 'function'
  ): T {
    return this.core.measureFunction(fn, name, category);
  }

  public async measureAsync<T>(
    promise: Promise<T>,
    name: string,
    category: string = 'async'
  ): Promise<T> {
    return this.core.measureAsync(promise, name, category);
  }

  public recordCommandExecution(commandId: string, duration: number): void {
    this.recordMetricValue(
      'command_execution_time',
      duration,
      { commandId },
      { timestamp: Date.now() }
    );

    // Check if command execution exceeds performance threshold
    if (duration > 50) {
      const alert: PerformanceAlert = {
        id: `command-perf-${Date.now()}`,
        metric: 'command_execution_time',
        value: duration,
        threshold: 50,
        level: 'warning',
        message: `Command '${commandId}' execution time ${duration.toFixed(
          2
        )}ms exceeds 50ms threshold`,
        timestamp: Date.now(),
      };

      this.alertManager.recordAlert(alert);
      this.emit('alert', alert);
    }
  }

  public generateReport(): {
    metrics: PerformanceMetric[];
    benchmarks: PerformanceBenchmark[];
    alerts: PerformanceAlert[];
    systemSnapshot: SystemSnapshot;
  } {
    return {
      metrics: this.metricsTracker.getMetrics(),
      benchmarks: this.benchmarkManager.getBenchmarks(),
      alerts: this.alertManager.getAlerts(),
      systemSnapshot: this.systemProfiler.getSystemSnapshot(),
    };
  }

  // Configuration methods
  public updateConfig(config: Partial<PerformanceMonitorConfig>): void {
    this.configManager.updateConfig(config);
    this.config = this.configManager.getConfig();
  }

  public getConfig(): PerformanceMonitorConfig {
    return { ...this.config };
  }

  // Alert management
  public addThreshold(threshold: PerformanceThreshold): void {
    this.core.addThreshold(threshold);
  }

  public removeThreshold(metric: string): boolean {
    return this.core.removeThreshold(metric);
  }

  public getAlerts(level?: 'warning' | 'critical'): PerformanceAlert[] {
    return this.core.getAlerts(level);
  }

  // Data access
  public getMetrics(filter?: MetricFilter): PerformanceMetric[] {
    return this.core.getMetrics(filter);
  }

  public getBenchmarks(filter?: BenchmarkFilter): PerformanceBenchmark[] {
    return this.core.getBenchmarks(filter);
  }

  public getStatistics(metricName: string): {
    count: number;
    min: number;
    max: number;
    average: number;
    median: number;
    p95: number;
  } {
    return this.core.getStatistics(metricName);
  }

  public getSystemSnapshot(): SystemSnapshot {
    return this.core.getSystemSnapshot();
  }

  // Report generation
  public generateReport(): PerformanceReport {
    return this.core.generateReport();
  }

  // Circuit breaker
  public isCircuitBreakerActive(): boolean {
    return this.circuitBreaker.isActive();
  }

  public resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
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
    this.core.clearAll();
  }

  public clearMetrics(): void {
    this.core.clearMetrics();
  }

  public clearBenchmarks(): void {
    this.core.clearBenchmarks();
  }

  public clearAlerts(): void {
    this.core.clearAlerts();
  }

  public destroy(): void {
    this.clearAll();
    this.operations.destroy();
    this.eventManagerWrapper.clear();
    this.eventManagerWrapper.emit('destroyed');
  }

  // Private method for testing purposes
  private handleSystemMetric(
    name: string,
    value: number,
    metadata?: Record<string, unknown>
  ): void {
    this.recordMetricValue(name, value, { system: 'true' }, metadata);
  }
}
