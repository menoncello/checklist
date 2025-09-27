import type { BudgetViolation } from './PerformanceBudget';
import { PerformanceMonitorOperations } from './PerformanceMonitorOperations';
import { PerformanceMonitorSystemMetrics } from './PerformanceMonitorSystemMetrics';
import type { SlowOperationReport } from './SlowOperationDetector';

export class PerformanceMonitorAdvanced {
  constructor(
    private operations: PerformanceMonitorOperations,
    private systemMetrics: PerformanceMonitorSystemMetrics
  ) {}

  public getBudgetConfig() {
    return this.operations.getBudgetConfig();
  }

  public updateBudgetConfig(
    config: Parameters<typeof this.operations.updateBudgetConfig>[0]
  ) {
    return this.operations.updateBudgetConfig(config);
  }

  public getBudgetViolations(
    severity?: 'warning' | 'critical',
    since?: number
  ): BudgetViolation[] {
    return this.operations.getBudgetViolations(severity, since);
  }

  public getBudgetStatus() {
    return this.operations.getBudgetStatus();
  }

  public wrapSlowOperation<T extends (...args: unknown[]) => unknown>(
    fn: T,
    name: string,
    threshold?: number
  ): T {
    return this.operations.wrapSlowOperation(fn, name, threshold);
  }

  public async measureSlowAsync<T>(
    operation: () => Promise<T>,
    name: string,
    threshold?: number
  ): Promise<T> {
    return this.operations.measureSlowAsync(operation, name, threshold);
  }

  public measureSlow<T>(
    operation: () => T,
    name: string,
    threshold?: number
  ): T {
    return this.operations.measureSlow(operation, name, threshold);
  }

  public getSlowOperationReports(since?: number): SlowOperationReport[] {
    return this.operations.getSlowOperationReports(since);
  }

  public getSlowestOperations(count?: number): SlowOperationReport[] {
    return this.operations.getSlowestOperations(count);
  }

  public getCircuitBreakerState() {
    return this.operations.getCircuitBreakerState();
  }

  public getDataSanitizerConfig() {
    return this.operations.getDataSanitizerConfig();
  }

  public getMemoryUsage() {
    return this.operations.getMemoryUsage();
  }

  public testSanitization(text: string) {
    return this.operations.testSanitization(text);
  }

  public forceCleanup(): void {
    return this.operations.forceCleanup();
  }

  public startSystemMetricsCollection(): void {
    return this.systemMetrics.startCollection();
  }

  public stopSystemMetricsCollection(): void {
    return this.systemMetrics.stopCollection();
  }

  public getSystemMetricsSummary() {
    return this.systemMetrics.getSummary();
  }

  public resetSystemMetrics(): void {
    return this.systemMetrics.reset();
  }

  public enableAdvancedMetrics(): void {
    return this.systemMetrics.startCollection();
  }

  public disableAdvancedMetrics(): void {
    return this.systemMetrics.stopCollection();
  }

  public isAdvancedMetricsEnabled(): boolean {
    const summary = this.systemMetrics.getSummary();
    return (summary as { isCollecting?: boolean }).isCollecting ?? false;
  }

  public getAdvancedMetrics() {
    const summary = this.systemMetrics.getSummary();
    return (summary as { metrics?: unknown[] }).metrics ?? [];
  }
}
