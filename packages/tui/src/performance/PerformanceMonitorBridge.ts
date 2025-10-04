import { PerformanceMonitorUtils } from './PerformanceMonitorUtils';
import type { AlertManager } from './helpers/AlertManager';
import type { SystemProfiler } from './helpers/SystemProfiler';
import type {
  PerformanceAlert,
  PerformanceMonitorConfig,
  PerformanceMetric,
  PerformanceBenchmark,
  SystemSnapshot,
} from './types';

export interface PerformanceMonitorBridgeDeps {
  config: PerformanceMonitorConfig;
  alertManager: AlertManager;
  systemProfiler: SystemProfiler;
  eventHandlers: unknown;
  handlers: unknown;
}

export class PerformanceMonitorBridge {
  private config: PerformanceMonitorConfig;
  private alertManager: AlertManager;
  private systemProfiler: SystemProfiler;
  private eventHandlers: unknown;
  private handlers: unknown;

  constructor(deps: PerformanceMonitorBridgeDeps) {
    // Store a deep copy to ensure we have our own reference
    this.config = { ...deps.config };
    this.alertManager = deps.alertManager;
    this.systemProfiler = deps.systemProfiler;
    this.eventHandlers = deps.eventHandlers;
    this.handlers = deps.handlers;
  }

  public handleSystemMetric(
    name: string,
    value: number,
    metadata?: Record<string, unknown>,
    recordMetricValue?: (
      name: string,
      value: number,
      tags?: Record<string, string>,
      metadata?: Record<string, unknown>
    ) => void
  ): void {
    PerformanceMonitorUtils.handleSystemMetric({
      recordMetricValue: recordMetricValue ?? (() => {}),
      enableMetrics: this.config?.enableMetrics ?? true,
      name,
      value,
      metadata,
    });
  }

  public addAlert(alert: PerformanceAlert): void {
    if (this.alertManager == null) {
      return;
    }

    PerformanceMonitorUtils.addAlert(
      this.alertManager,
      this.config?.enableAlerts ?? true,
      alert
    );
  }

  public updateConfig(
    newConfig: Partial<PerformanceMonitorConfig>,
    callbacks?: {
      startAutoSampling?: () => void;
      stopAutoSampling?: () => void;
      emitConfigUpdate?: (config: PerformanceMonitorConfig) => void;
    }
  ): PerformanceMonitorConfig {
    if (this.config == null) {
      throw new Error('Configuration not initialized');
    }

    const updatedConfig = PerformanceMonitorUtils.updateConfig(
      this.config,
      newConfig,
      {
        startAutoSampling: callbacks?.startAutoSampling ?? (() => {}),
        stopAutoSampling: callbacks?.stopAutoSampling ?? (() => {}),
        emitConfigUpdate: callbacks?.emitConfigUpdate ?? (() => {}),
      }
    );

    // Update local reference
    this.config = updatedConfig;
    return updatedConfig;
  }

  public destroy(callbacks?: {
    stopAutoSampling?: () => void;
    clearAll?: () => void;
  }): void {
    // Safely handle all cleanup operations with fallbacks
    const stopAutoSampling = callbacks?.stopAutoSampling ?? (() => {});
    const systemProfiler = this.systemProfiler ?? { stop: () => {} };
    const clearAll = callbacks?.clearAll ?? (() => {});

    PerformanceMonitorUtils.destroy(
      stopAutoSampling,
      systemProfiler,
      clearAll,
      // Safely handle eventHandlers cleanup with fallback
      {
        clear: () => {
          if (
            this.eventHandlers != null &&
            typeof this.eventHandlers === 'object' &&
            'clear' in this.eventHandlers &&
            typeof this.eventHandlers.clear === 'function'
          ) {
            (this.eventHandlers as { clear: () => void }).clear();
          }
        },
      }
    );
  }

  public getUptime(startTime: number): number {
    return PerformanceMonitorUtils.getUptime(startTime);
  }

  public getReport(
    getMetricsCallback: () => PerformanceMetric[],
    getBenchmarksCallback: () => PerformanceBenchmark[],
    getAlertsCallback: () => PerformanceAlert[],
    getSystemSnapshotCallback: () => SystemSnapshot
  ) {
    return {
      metrics: getMetricsCallback(),
      benchmarks: getBenchmarksCallback(),
      alerts: getAlertsCallback(),
      systemSnapshot: getSystemSnapshotCallback(),
    };
  }
}
