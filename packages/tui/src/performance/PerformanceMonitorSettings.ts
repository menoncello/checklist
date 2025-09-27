import type { PerformanceMonitorConfig } from './PerformanceMonitorConfig';
import type { PerformanceMonitorInternal } from './PerformanceMonitorTypes';
import type {
  PerformanceThreshold,
  PerformanceAlert,
} from './helpers/AlertManager';

/**
 * Configuration and alert management for PerformanceMonitor
 */
export class PerformanceMonitorSettings {
  constructor(private monitor: PerformanceMonitorInternal) {}

  // Configuration methods
  public updateConfig(config: Partial<PerformanceMonitorConfig>): void {
    this.monitor.configManager.updateConfig(config);
    this.monitor.config = this.monitor.configManager.getConfig();
  }

  public getConfig(): PerformanceMonitorConfig {
    return { ...this.monitor.config };
  }

  // Alert management
  public addThreshold(threshold: PerformanceThreshold): void {
    this.monitor.core.addThreshold(threshold);
  }

  public removeThreshold(metric: string): boolean {
    return this.monitor.core.removeThreshold(metric);
  }

  public getAlerts(level?: 'warning' | 'critical'): PerformanceAlert[] {
    return this.monitor.core.getAlerts(level);
  }
}
