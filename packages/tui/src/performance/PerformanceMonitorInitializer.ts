/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/prefer-nullish-coalescing */
// Temporary any usage is justified for bridging performance monitoring interface incompatibilities
// These any types bridge conflicting interface definitions between performance monitoring components
// This will be resolved in future refactoring when performance interfaces are unified

import { CommandPerformanceTracker } from './CommandPerformanceTracker';
import { EventHandlers } from './EventHandlers';
import { MeasurementMethods } from './MeasurementMethods';
import { PerformanceCircuitBreaker } from './PerformanceCircuitBreaker';
import { PerformanceMonitorBridge } from './PerformanceMonitorBridge';
import {
  PerformanceMonitorHandlers,
  type AlertManager,
  type MetricsTracker,
  type BenchmarkManager,
} from './PerformanceMonitorHandlers';
import type { PerformanceMonitorConfig } from './PerformanceMonitorSlim';
import { type PerformanceThreshold } from './helpers/AlertManager';
import { AlertManager as AlertManagerImpl } from './helpers/AlertManager';
import {
  type PerformanceBenchmark,
  type BenchmarkFilter,
} from './helpers/BenchmarkManager';
import { BenchmarkManager as BenchmarkManagerImpl } from './helpers/BenchmarkManager';
import { type MetricFilter } from './helpers/MetricsTracker';
import { MetricsTracker as MetricsTrackerImpl } from './helpers/MetricsTracker';
import { SystemProfiler } from './helpers/SystemProfiler';

// Import the actual implementation classes

export class PerformanceMonitorInitializer {
  public static initializeConfig(
    config?: Partial<PerformanceMonitorConfig>
  ): PerformanceMonitorConfig {
    return {
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
      ...config,
    };
  }

  public static initializeManagers(
    config: PerformanceMonitorConfig,
    emitCallback: (event: string, data: unknown) => void
  ) {
    const coreManagers = this.createCoreManagers(config);
    const circuitBreaker = this.createCircuitBreaker();
    const { commandTracker, eventHandlers, handlers } =
      this.createTrackingManagers(
        coreManagers,
        config,
        emitCallback,
        circuitBreaker
      );

    return {
      ...coreManagers,
      circuitBreaker,
      commandTracker,
      eventHandlers,
      handlers,
    };
  }

  private static createCoreManagers(config: PerformanceMonitorConfig) {
    return {
      metricsTracker: new MetricsTrackerImpl(config.metricsBufferSize),
      benchmarkManager: new BenchmarkManagerImpl(config.benchmarksBufferSize),
      alertManager: new AlertManagerImpl(config.alertsBufferSize),
      systemProfiler: new SystemProfiler(config.samplingInterval),
    };
  }

  private static createCircuitBreaker() {
    return new PerformanceCircuitBreaker({
      enabled: true,
      overheadThreshold: 0.1,
    });
  }

  private static createTrackingManagers(
    coreManagers: {
      alertManager: AlertManagerImpl;
      metricsTracker: MetricsTrackerImpl;
      benchmarkManager: BenchmarkManagerImpl;
    },
    config: PerformanceMonitorConfig,
    emitCallback: (event: string, data: unknown) => void,
    _circuitBreaker: PerformanceCircuitBreaker
  ) {
    const commandTracker = new CommandPerformanceTracker(
      coreManagers.alertManager,
      coreManagers.metricsTracker,
      emitCallback
    );

    const eventHandlers = new EventHandlers();

    // Bridge type incompatibility between performance monitoring interfaces
    // These any types are justified to bridge conflicting interface definitions
    const handlers = new PerformanceMonitorHandlers({
      alertManager: coreManagers.alertManager as any,
      metricsTracker: coreManagers.metricsTracker as any,
      benchmarkManager: coreManagers.benchmarkManager as any,
      config,
      emit: emitCallback,
    });

    return { commandTracker, eventHandlers, handlers };
  }

  public static initializeBridge(deps: {
    config: PerformanceMonitorConfig;
    alertManager: AlertManager;
    systemProfiler: SystemProfiler;
    eventHandlers: EventHandlers;
    handlers: PerformanceMonitorHandlers;
  }): PerformanceMonitorBridge {
    return new PerformanceMonitorBridge(deps as any);
  }

  public static initializeMeasurementMethods(
    startBenchmarkCallback: (name: string, category?: string) => string,
    endBenchmarkCallback: (benchmarkId: string) => PerformanceBenchmark | null,
    config: PerformanceMonitorConfig
  ): MeasurementMethods {
    return new MeasurementMethods(
      startBenchmarkCallback,
      endBenchmarkCallback,
      config
    );
  }

  public static initializeCore(deps: {
    metricsTracker: MetricsTracker;
    benchmarkManager: BenchmarkManager;
    alertManager: AlertManager;
    systemProfiler: SystemProfiler;
    handlers: PerformanceMonitorHandlers;
  }): Record<string, Function> {
    return {
      ...this.initializeMetricsCore(deps),
      ...this.initializeBenchmarksCore(deps),
      ...this.initializeAlertsCore(deps),
      ...this.initializeSystemCore(deps),
    };
  }

  private static initializeMetricsCore(deps: {
    metricsTracker: MetricsTracker;
    handlers: PerformanceMonitorHandlers;
  }): Record<string, Function> {
    return {
      mark: (name: string) =>
        (deps.metricsTracker as any).mark?.(name) || (() => {}),
      measure: (name: string, start: string, end: string) =>
        (deps.metricsTracker as any).measure?.(name, start, end) || (() => {}),
      recordMetricValue: (
        name: string,
        value: number,
        tags: Record<string, string>,
        metadata: Record<string, unknown>
      ) => deps.handlers.handleRecordMetricValue(name, value, tags, metadata),
      getStatistics: (metricName: string) =>
        (deps.metricsTracker as any).getStatistics?.(metricName) || {},
      getMetrics: (filter?: MetricFilter) =>
        deps.metricsTracker.getMetrics(filter),
      clearMetrics: () => (deps.metricsTracker as any).clear?.() || (() => {}),
    };
  }

  private static initializeBenchmarksCore(deps: {
    benchmarkManager: BenchmarkManager;
  }): Record<string, Function> {
    return {
      getBenchmarks: (filter?: BenchmarkFilter) =>
        deps.benchmarkManager.getBenchmarks(filter),
      clearBenchmarks: () =>
        (deps.benchmarkManager as any).clear?.() || (() => {}),
    };
  }

  private static initializeAlertsCore(deps: {
    alertManager: AlertManager;
    handlers: PerformanceMonitorHandlers;
  }): Record<string, Function> {
    return {
      clearAlerts: () => (deps.alertManager as any).clear?.() || (() => {}),
      addThreshold: (threshold: PerformanceThreshold) =>
        deps.handlers.handleAddThreshold(threshold),
      removeThreshold: (metricName: string) =>
        deps.handlers.handleRemoveThreshold(metricName),
      getAlerts: (level?: string) => deps.handlers.handleGetAlerts(level),
    };
  }

  private static initializeSystemCore(deps: {
    systemProfiler: SystemProfiler;
  }): Record<string, Function> {
    return {
      getSystemSnapshot: () => deps.systemProfiler.getSystemSnapshot(),
    };
  }

  public static initializeComponents(
    alertManager: AlertManager,
    systemProfiler: SystemProfiler,
    circuitBreaker: PerformanceCircuitBreaker
  ) {
    return {
      alertManager,
      systemProfiler,
      circuitBreaker,
    };
  }
}
