import type { PerformanceMonitorConfig } from './PerformanceMonitorConfig';
import type { PerformanceMonitorEventManager } from './helpers/PerformanceMonitorEventManager';
import type { PerformanceMonitorComponents } from './helpers/PerformanceMonitorFactory';

export class PerformanceMonitorConfigManager {
  constructor(
    private config: PerformanceMonitorConfig,
    private components: PerformanceMonitorComponents,
    private eventManager: PerformanceMonitorEventManager
  ) {}

  public updateConfig(newConfig: Partial<PerformanceMonitorConfig>): void {
    const wasAutoSampling = this.config.enableAutoSampling;
    this.config = { ...this.config, ...newConfig };

    if (wasAutoSampling !== this.config.enableAutoSampling) {
      if (this.config.enableAutoSampling === true) {
        this.components.systemProfiler.start();
      } else {
        this.components.systemProfiler.stop();
      }
    }

    this.eventManager.emit('configUpdated', this.config);
  }

  public getConfig(): PerformanceMonitorConfig {
    return { ...this.config };
  }
}
