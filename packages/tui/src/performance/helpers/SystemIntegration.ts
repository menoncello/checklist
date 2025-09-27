import type { PerformanceBudget } from '../PerformanceBudget';
import type { PerformanceMonitorConfig } from '../PerformanceMonitorConfig';
import type { AlertManager } from './AlertManager';
import type { PerformanceMetric } from './MetricsTracker';
import type { SystemProfiler } from './SystemProfiler';

interface EventEmitter {
  emit(event: string, data?: unknown): void;
}

export class SystemIntegration {
  constructor(
    private config: PerformanceMonitorConfig,
    private components: {
      performanceBudget: PerformanceBudget;
      alertManager: AlertManager;
      systemProfiler: SystemProfiler;
      eventEmitter: EventEmitter;
    }
  ) {}

  handleSystemMetric(
    name: string,
    value: number,
    metadata?: Record<string, unknown>
  ): void {
    if (this.config.enableMetrics !== true) return;

    const metric: PerformanceMetric = {
      id: `system-${Date.now()}-${Math.random()}`,
      name,
      value,
      timestamp: Date.now(),
      metadata,
    };

    // Check against performance budget
    const budgetViolation =
      this.components.performanceBudget.checkMetric(metric);
    if (budgetViolation != null) {
      this.components.eventEmitter.emit('budgetViolation', budgetViolation);
    }

    if (this.config.enableAlerts === true) {
      const alert = this.components.alertManager.checkMetric(metric);
      if (alert != null) {
        this.components.eventEmitter.emit('alert', alert);
      }
    }
  }

  updateConfig(newConfig: Partial<PerformanceMonitorConfig>): void {
    const wasAutoSampling = this.config.enableAutoSampling;
    Object.assign(this.config, newConfig);

    if (wasAutoSampling !== this.config.enableAutoSampling) {
      if (this.config.enableAutoSampling === true) {
        this.components.systemProfiler.start();
      } else {
        this.components.systemProfiler.stop();
      }
    }

    this.components.eventEmitter.emit('configUpdated', this.config);
  }

  destroy(): void {
    this.components.systemProfiler.stop();
  }
}
