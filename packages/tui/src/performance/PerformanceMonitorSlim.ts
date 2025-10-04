/* eslint-disable @typescript-eslint/no-explicit-any */
// Temporary any usage is justified for bridging performance monitoring interface incompatibilities
// These any types bridge conflicting interface definitions between performance monitoring components
// This will be resolved in future refactoring when performance interfaces are unified

import type { CommandPerformanceTracker } from './CommandPerformanceTracker';
import type { EventHandlers } from './EventHandlers';
import type { PerformanceCircuitBreaker } from './PerformanceCircuitBreaker';
import {
  PerformanceMonitorAccessors,
  PerformanceMonitorComponents,
} from './PerformanceMonitorAccessors';
import { PerformanceMonitorBenchmarkOperations } from './PerformanceMonitorBenchmarkOperations';
import { PerformanceMonitorBridge } from './PerformanceMonitorBridge';
import { PerformanceMonitorCoreOperations } from './PerformanceMonitorCoreOperations';
import { PerformanceMonitorEventHandlers } from './PerformanceMonitorEventHandlers';
import type { PerformanceMonitorHandlers } from './PerformanceMonitorHandlers';
import { PerformanceMonitorInitializer } from './PerformanceMonitorInitializer';
import { PerformanceMonitorMeasurements } from './PerformanceMonitorMeasurements';
import { PerformanceMonitorMetricOperations } from './PerformanceMonitorMetricOperations';
import type { AlertManager } from './helpers/AlertManager';
import type { BenchmarkManager } from './helpers/BenchmarkManager';
import type { MetricsTracker } from './helpers/MetricsTracker';
import type { SystemProfiler } from './helpers/SystemProfiler';
import type {
  PerformanceMetric,
  PerformanceBenchmark,
  PerformanceAlert,
  SystemSnapshot,
} from './types';

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

export class PerformanceMonitor {
  private config: PerformanceMonitorConfig;
  public metricsTracker!: MetricsTracker;
  public benchmarkManager!: BenchmarkManager;
  public alertManager!: AlertManager;
  public systemProfiler!: SystemProfiler;
  public circuitBreaker!: PerformanceCircuitBreaker;
  private commandTracker!: CommandPerformanceTracker;
  private measurements!: PerformanceMonitorMeasurements;
  private eventHandlers!: EventHandlers;
  private handlers!: PerformanceMonitorHandlers;
  private bridge!: PerformanceMonitorBridge;
  private accessors!: PerformanceMonitorAccessors;
  private coreOperations!: PerformanceMonitorCoreOperations;
  private eventHandlersManager!: PerformanceMonitorEventHandlers;
  private benchmarkOperations!: PerformanceMonitorBenchmarkOperations;
  private metricOperations!: PerformanceMonitorMetricOperations;
  private startTime = performance.now();
  private _core!: Record<string, Function>;
  private _components!: PerformanceMonitorComponents;

  constructor(config?: Partial<PerformanceMonitorConfig>) {
    this.config = PerformanceMonitorInitializer.initializeConfig(config);
    this.initializeManagers();
    this.initializeBridge();
    this.initializeCore();
    this.initializeComponents();
    this.addDefaultThreshold();
  }

  private initializeManagers(): void {
    const managers = PerformanceMonitorInitializer.initializeManagers(
      this.config,
      (event, data) => this.emit(event, data)
    );

    this.metricsTracker = managers.metricsTracker;
    this.benchmarkManager = managers.benchmarkManager;
    this.alertManager = managers.alertManager;
    this.systemProfiler = managers.systemProfiler;
    this.circuitBreaker = managers.circuitBreaker;
    this.commandTracker = managers.commandTracker;
    this.eventHandlers = managers.eventHandlers;
    this.handlers = managers.handlers;
  }

  private initializeBridge(): void {
    this.bridge = PerformanceMonitorInitializer.initializeBridge({
      config: this.config,
      alertManager: this.alertManager as any,
      systemProfiler: this.systemProfiler,
      eventHandlers: this.eventHandlers,
      handlers: this.handlers,
    });
  }

  private initializeCore(): void {
    const measurementMethods =
      PerformanceMonitorInitializer.initializeMeasurementMethods(
        (name: string, category?: string) =>
          this.startBenchmark(name, category),
        (benchmarkId: string) => this.endBenchmark(benchmarkId),
        this.config
      );
    this.measurements = new PerformanceMonitorMeasurements(measurementMethods);

    this._core = PerformanceMonitorInitializer.initializeCore({
      metricsTracker: this.metricsTracker as any,
      benchmarkManager: this.benchmarkManager as any,
      alertManager: this.alertManager as any,
      systemProfiler: this.systemProfiler,
      handlers: this.handlers,
    });
  }

  private initializeComponents(): void {
    this._components = PerformanceMonitorInitializer.initializeComponents(
      this.alertManager as any,
      this.systemProfiler,
      this.circuitBreaker
    ) as any;

    this.accessors = new PerformanceMonitorAccessors(
      this._core,
      this._components
    );
    this.coreOperations = new PerformanceMonitorCoreOperations(this._core);
    this.eventHandlersManager = new PerformanceMonitorEventHandlers(
      this.eventHandlers
    );
    this.benchmarkOperations = new PerformanceMonitorBenchmarkOperations(
      this.benchmarkManager,
      this.alertManager,
      this.config
    );
    this.metricOperations = new PerformanceMonitorMetricOperations(
      this.config,
      this.metricsTracker,
      this.alertManager
    );
  }

  private addDefaultThreshold(): void {
    this.addThreshold({
      metric: 'command_execution_time',
      warningValue: 50,
      criticalValue: 100,
      direction: 'above',
    });
  }

  public getMetrics(filter?: unknown): PerformanceMetric[] {
    return this._core.getMetrics(filter);
  }

  public getBenchmarks(filter?: unknown): PerformanceBenchmark[] {
    return this._core.getBenchmarks(filter);
  }

  public getAlerts(level?: string): PerformanceAlert[] {
    return this._core.getAlerts(level);
  }

  public startBenchmark(
    name: string,
    category: string = 'general',
    metadata?: Record<string, unknown>
  ): string {
    return this.benchmarkOperations.startBenchmark(name, category, metadata);
  }

  public endBenchmark(id: string): PerformanceBenchmark | null {
    return this.benchmarkOperations.endBenchmark(id);
  }

  public mark(name: string): number {
    return this._core.mark(name);
  }

  public measure(name: string, start: string, end: string): number {
    return this._core.measure(name, start, end);
  }

  public recordMetricValue(
    name: string,
    value: number,
    tags?: Record<string, string>,
    metadata?: Record<string, unknown>
  ): void {
    this._core.recordMetricValue(name, value, tags, metadata);
  }

  public getStatistics(metricName: string) {
    return this._core.getStatistics(metricName);
  }

  public getSystemSnapshot(): SystemSnapshot {
    return this._core.getSystemSnapshot();
  }

  public getConfig(): PerformanceMonitorConfig {
    return { ...this.config };
  }

  public recordMetric(metric: PerformanceMetric): void {
    this.metricOperations.recordMetric(metric);
    if (this.config?.enableAlerts) {
      const alert = this.alertManager.checkMetric(metric);
      if (alert) {
        this.emit('alert', alert);
      }
    }
  }

  public on(event: string, handler: (...args: unknown[]) => void): void {
    this.eventHandlersManager.on(event, handler);
  }

  public off(event: string, handler: (...args: unknown[]) => void): void {
    this.eventHandlersManager.off(event, handler);
  }

  public emit(event: string, data: unknown): void {
    this.eventHandlersManager.emit(event, data);
  }

  public getReport() {
    return this.bridge.getReport(
      () => this.getMetrics(),
      () => this.getBenchmarks(),
      () => this.getAlerts(),
      () => this.getSystemSnapshot()
    );
  }

  public generateReport() {
    return this.getReport();
  }

  public handleSystemMetric(
    name: string,
    value: number,
    metadata?: Record<string, unknown>
  ): void {
    this.bridge.handleSystemMetric(
      name,
      value,
      metadata,
      (name, value, tags, metadata) =>
        this.recordMetricValue(name, value, tags, metadata)
    );
  }

  public addAlert(alert: PerformanceAlert): void {
    this.bridge.addAlert(alert);
  }

  public updateConfig(newConfig: Partial<PerformanceMonitorConfig>): void {
    this.config = this.bridge.updateConfig(newConfig, {
      startAutoSampling: () => this.handlers.startAutoSampling(),
      stopAutoSampling: () => this.handlers.stopAutoSampling(),
      emitConfigUpdate: (config) => this.emit('configUpdated', config),
    });
  }

  public destroy(): void {
    this.bridge.destroy({
      stopAutoSampling: () => this.handlers.stopAutoSampling(),
      clearAll: () => this.clearAll(),
    });
  }

  public getUptime(): number {
    return this.bridge.getUptime(this.startTime);
  }

  public recordCommandExecution(commandId: string, duration: number): void {
    if (!this.config.enableMetrics) return;
    this.commandTracker.recordCommandExecution(commandId, duration);
  }

  public addThreshold(threshold: {
    metricName?: string;
    metric?: string;
    warningValue: number;
    criticalValue: number;
    direction: 'above' | 'below';
  }): void {
    this._core.addThreshold(threshold);
  }

  public removeThreshold(metricName: string): boolean {
    return this._core.removeThreshold(metricName);
  }

  public clearAll(): void {
    this.metricOperations.clearMetrics();
    this.benchmarkOperations.clearBenchmarks();
    this.alertManager.clear();
  }

  public clearMetrics(): void {
    this._core.clearMetrics();
  }

  public clearBenchmarks(): void {
    this._core.clearBenchmarks();
  }

  public clearAlerts(): void {
    this._core.clearAlerts();
  }

  public measureFunction<T extends (...args: unknown[]) => unknown>(
    fn: T,
    name?: string,
    category: string = 'functions'
  ): T {
    return this.measurements.measureFunction(fn, name, category);
  }

  public async measureAsync<T>(
    promise: Promise<T>,
    name: string,
    category: string = 'async-ops'
  ): Promise<T> {
    return this.measurements.measureAsync(promise, name, category);
  }

  public get components() {
    return this.accessors.components;
  }

  public get core(): Record<string, Function> {
    return this.accessors.core;
  }
}
