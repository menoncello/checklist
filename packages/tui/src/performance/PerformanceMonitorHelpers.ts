import { DataSanitizer } from './DataSanitizer';
import { MetricsBuffer } from './MetricsBuffer';
import type { BudgetViolation } from './PerformanceBudget';
import { PerformanceCircuitBreaker } from './PerformanceCircuitBreaker';
import type { PerformanceAlert } from './helpers/AlertManager';
import type { PerformanceMetric } from './helpers/MetricsTracker';
import type { PerformanceMonitorEventManager } from './helpers/PerformanceMonitorEventManager';

export interface PerformanceMonitorHelpersConfig {
  dataSanitizer: DataSanitizer;
  metricsBuffer: MetricsBuffer;
  circuitBreaker: PerformanceCircuitBreaker;
  eventManager: PerformanceMonitorEventManager;
  components: {
    performanceBudget: {
      checkMetric: (metric: PerformanceMetric) => BudgetViolation | null;
    };
    alertManager: {
      checkMetric: (metric: PerformanceMetric) => PerformanceAlert | null;
    };
  };
  config: { enableAlerts: boolean };
}

export class PerformanceMonitorHelpers {
  constructor(private config: PerformanceMonitorHelpersConfig) {}

  public createMetric(
    name: string,
    value: number,
    metadata?: Record<string, unknown>
  ): PerformanceMetric {
    const sanitizedMetadata = metadata
      ? this.config.dataSanitizer.sanitizeMetadata(metadata)
      : undefined;

    return {
      id: `system-${Date.now()}-${Math.random()}`,
      name,
      value,
      timestamp: Date.now(),
      metadata: sanitizedMetadata,
    };
  }

  public processMetric(metric: PerformanceMetric): void {
    this.config.metricsBuffer.push(metric);
    this.checkBudgetViolation(metric);
    this.checkAlerts(metric);
  }

  private checkBudgetViolation(metric: PerformanceMetric): void {
    const budgetViolation =
      this.config.components.performanceBudget.checkMetric(metric);
    if (budgetViolation != null) {
      this.config.eventManager.emit('budgetViolation', budgetViolation);
    }
  }

  private checkAlerts(metric: PerformanceMetric): void {
    if (this.config.config.enableAlerts !== true) return;

    const alert = this.config.components.alertManager.checkMetric(metric);
    if (alert != null) {
      this.config.eventManager.emit('alert', alert);
    }
  }

  public logSignificantOverhead(overhead: number, name: string): void {
    if (overhead > 0.001) {
      console.debug(
        `[PerformanceMonitor] Metric ${name} overhead: ${(overhead * 100).toFixed(3)}%`
      );
    }
  }

  public shouldCollectMetrics(): boolean {
    return (
      this.config.config.enableAlerts === true &&
      this.config.circuitBreaker.shouldCollectMetrics()
    );
  }

  public shouldSampleMetric(name: string): boolean {
    const criticalMetrics = [
      'render-time',
      'memory-usage',
      'cpu-usage',
      'memory.usage',
    ];

    if (criticalMetrics.includes(name)) {
      return true;
    }

    this.samplingCounter = (this.samplingCounter + 1) % 10;
    return this.samplingCounter === 0;
  }

  public isNonCriticalMetric(name: string): boolean {
    const nonCriticalMetrics = [
      'user-interaction',
      'ui-update',
      'network-request',
      'dom-operation',
    ];
    return nonCriticalMetrics.includes(name);
  }

  private samplingCounter = 0;
}
