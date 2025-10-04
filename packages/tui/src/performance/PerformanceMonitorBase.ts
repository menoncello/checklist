import { PerformanceMonitorBridge } from './PerformanceMonitorBridge';
import { PerformanceMonitorEventHandlers } from './PerformanceMonitorEventHandlers';
import type { AlertManager } from './helpers/AlertManager';
import type { SystemProfiler } from './helpers/SystemProfiler';
import type { PerformanceAlert, PerformanceMonitorConfig } from './types';

export interface PerformanceMonitorDependencies {
  config: PerformanceMonitorConfig;
  alertManager: AlertManager;
  systemProfiler: SystemProfiler;
  handlers: unknown;
  bridge: PerformanceMonitorBridge;
  eventHandlersManager: PerformanceMonitorEventHandlers;
}

export class PerformanceMonitorBase {
  protected config: PerformanceMonitorConfig;
  protected alertManager: AlertManager;
  protected systemProfiler: SystemProfiler;
  protected handlers: unknown;
  protected bridge: PerformanceMonitorBridge;
  protected eventHandlersManager: PerformanceMonitorEventHandlers;

  constructor(deps: PerformanceMonitorDependencies) {
    this.config = deps.config;
    this.alertManager = deps.alertManager;
    this.systemProfiler = deps.systemProfiler;
    this.handlers = deps.handlers;
    this.bridge = deps.bridge;
    this.eventHandlersManager = deps.eventHandlersManager;
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
    this.bridge.handleSystemMetric(name, value, metadata, recordMetricValue);
  }

  public addAlert(alert: PerformanceAlert): void {
    this.bridge.addAlert(alert);
  }

  public updateConfig(newConfig: Partial<PerformanceMonitorConfig>): void {
    this.config = this.bridge.updateConfig(newConfig, {
      startAutoSampling: () => {
        // Implement auto-sampling start logic or use fallback
        console.debug('Auto-sampling started');
      },
      stopAutoSampling: () => {
        // Implement auto-sampling stop logic or use fallback
        console.debug('Auto-sampling stopped');
      },
      emitConfigUpdate: (config) => this.emit('configUpdated', config),
    });
  }

  public destroy(): void {
    this.bridge.destroy({
      stopAutoSampling: () => {
        // Implement auto-sampling stop logic or use fallback
        console.debug('Auto-sampling stopped during destroy');
      },
      clearAll: () => this.clearAll(),
    });
  }

  public getUptime(startTime: number): number {
    return this.bridge.getUptime(startTime);
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

  protected clearAll(): void {
    // To be implemented by child class
  }
}
