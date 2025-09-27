import type { PerformanceBudget, BudgetViolation } from '../PerformanceBudget';
import type {
  SlowOperationDetector,
  SlowOperationReport,
} from '../SlowOperationDetector';

export class BudgetOperations {
  constructor(
    private performanceBudget: PerformanceBudget,
    private slowOperationDetector: SlowOperationDetector
  ) {}

  getBudgetConfig() {
    return this.performanceBudget.getConfig();
  }

  updateBudgetConfig(
    config: Parameters<typeof this.performanceBudget.updateConfig>[0]
  ) {
    this.performanceBudget.updateConfig(config);
  }

  getBudgetViolations(
    severity?: 'warning' | 'critical',
    since?: number
  ): BudgetViolation[] {
    return this.performanceBudget.getViolations(severity, since);
  }

  getBudgetStatus() {
    return this.performanceBudget.getStatus();
  }

  wrapSlowOperation<T extends (...args: unknown[]) => unknown>(
    fn: T,
    name: string,
    threshold?: number
  ): T {
    return this.slowOperationDetector.wrapFunction(fn, name, threshold);
  }

  async measureSlowAsync<T>(
    operation: () => Promise<T>,
    name: string,
    threshold?: number
  ): Promise<T> {
    return this.slowOperationDetector.measureAsync(operation, name, threshold);
  }

  measureSlow<T>(operation: () => T, name: string, threshold?: number): T {
    return this.slowOperationDetector.measure(operation, name, threshold);
  }

  getSlowOperationReports(since?: number): SlowOperationReport[] {
    return this.slowOperationDetector.getReports(since);
  }

  getSlowestOperations(count?: number): SlowOperationReport[] {
    return this.slowOperationDetector.getSlowestOperations(count);
  }
}
