import type { BudgetViolation } from './PerformanceBudget';
import type { PerformanceAlert } from './helpers/AlertManager';
import type { PerformanceMetric } from './helpers/MetricsTracker';
import type { PerformanceMonitorEventManager } from './helpers/PerformanceMonitorEventManager';

export class PerformanceMonitorAsync {
  private pendingOperations = new Set<Promise<unknown>>();
  private weakRefs = new WeakMap<object, { id: string; timestamp: number }>();

  constructor(
    private eventManager: PerformanceMonitorEventManager,
    private components: {
      performanceBudget: {
        checkMetric: (metric: PerformanceMetric) => BudgetViolation | null;
      };
      alertManager: {
        checkMetric: (metric: PerformanceMetric) => PerformanceAlert | null;
      };
    },
    private config: { enableAlerts: boolean }
  ) {}

  public async processMetricAsync(metric: PerformanceMetric): Promise<void> {
    const metricRef = new WeakRef(metric);
    this.weakRefs.set(metric, { id: metric.id, timestamp: metric.timestamp });

    const operation = Promise.resolve().then(async () => {
      const actualMetric = metricRef.deref();
      if (actualMetric) {
        this.processMetricSync(actualMetric);
      }
      this.weakRefs.delete(metric);
    });

    this.pendingOperations.add(operation);
    operation.finally(() => {
      this.pendingOperations.delete(operation);
    });
  }

  private processMetricSync(metric: PerformanceMetric): void {
    const budgetViolation =
      this.components.performanceBudget.checkMetric(metric);
    if (budgetViolation != null) {
      this.eventManager.emit('budgetViolation', budgetViolation);
    }

    if (this.config.enableAlerts === true) {
      const alert = this.components.alertManager.checkMetric(metric);
      if (alert != null) {
        this.eventManager.emit('alert', alert);
      }
    }
  }

  public getMemoryUsage() {
    const weakRefCount = 0;

    return {
      pendingOperations: this.pendingOperations.size,
      weakRefs: weakRefCount,
    };
  }

  public forceCleanup(): void {
    const completedOps: Promise<unknown>[] = [];
    completedOps.forEach((op) => this.pendingOperations.delete(op));
  }

  public async processAll(): Promise<void> {
    await Promise.all(this.pendingOperations);
  }

  public getPendingCount(): number {
    return this.pendingOperations.size;
  }

  public destroy(): void {
    this.pendingOperations.clear();
    this.weakRefs = new WeakMap();
  }
}
