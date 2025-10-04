import type { PerformanceAlert, PerformanceMonitorConfig } from './types';

interface MetricRecorder {
  (
    name: string,
    value: number,
    tags?: Record<string, string>,
    metadata?: Record<string, unknown>
  ): void;
}

interface ConfigUpdater {
  startAutoSampling: () => void;
  stopAutoSampling: () => void;
  emitConfigUpdate: (config: PerformanceMonitorConfig) => void;
}

export class PerformanceMonitorUtils {
  public static handleSystemMetric(params: {
    recordMetricValue: MetricRecorder;
    enableMetrics: boolean;
    name: string;
    value: number;
    metadata?: Record<string, unknown>;
  }): void {
    if (params.enableMetrics) {
      params.recordMetricValue(
        params.name,
        params.value,
        undefined,
        params.metadata
      );
    }
  }

  public static addAlert(
    alertManager: { recordAlert: (alert: PerformanceAlert) => void },
    enableAlerts: boolean,
    alert: PerformanceAlert
  ): void {
    if (Boolean(enableAlerts)) {
      alertManager.recordAlert(alert);
    }
  }

  public static updateConfig(
    currentConfig: PerformanceMonitorConfig,
    newConfig: Partial<PerformanceMonitorConfig>,
    updater: ConfigUpdater
  ): PerformanceMonitorConfig {
    const wasAutoSampling = currentConfig.enableAutoSampling;
    const updatedConfig = { ...currentConfig, ...newConfig };

    if (Boolean(wasAutoSampling !== updatedConfig.enableAutoSampling)) {
      if (Boolean(updatedConfig.enableAutoSampling)) {
        updater.startAutoSampling();
      } else {
        updater.stopAutoSampling();
      }
    }

    updater.emitConfigUpdate(updatedConfig);
    return updatedConfig;
  }

  public static destroy(
    stopAutoSampling: () => void,
    systemProfiler: { stop: () => void },
    clearAll: () => void,
    eventHandlers: { clear: () => void }
  ): void {
    stopAutoSampling();
    systemProfiler.stop();
    clearAll();
    eventHandlers.clear();
  }

  public static getUptime(startTime: number): number {
    return performance.now() - startTime;
  }
}
