import type { DataSanitizer } from './DataSanitizer';
import type { MetricsBuffer } from './MetricsBuffer';
import type { PerformanceCircuitBreaker } from './PerformanceCircuitBreaker';
import type { PerformanceMonitorAsync } from './PerformanceMonitorAsync';
import type { PerformanceMonitorConfig } from './PerformanceMonitorConfig';
import type { SlowOperationReport } from './SlowOperationDetector';
import type { PerformanceMonitorComponents } from './helpers/PerformanceMonitorFactory';

export interface PerformanceMonitorOperationsConfig {
  circuitBreaker: PerformanceCircuitBreaker;
  dataSanitizer: DataSanitizer;
  metricsBuffer: MetricsBuffer;
  components: PerformanceMonitorComponents;
  config: PerformanceMonitorConfig;
  asyncProcessor: PerformanceMonitorAsync;
}

export class PerformanceMonitorOperations {
  constructor(private config: PerformanceMonitorOperationsConfig) {}

  public getCircuitBreakerState() {
    return this.config.circuitBreaker.getState();
  }

  public getDataSanitizerConfig() {
    return this.config.dataSanitizer.getConfig();
  }

  public getMemoryUsage() {
    return {
      bufferSize: this.config.metricsBuffer.getMemoryUsage(),
      ...this.config.asyncProcessor.getMemoryUsage(),
    };
  }

  public testSanitization(text: string) {
    return this.config.dataSanitizer.testSanitization(text);
  }

  public forceCleanup(): void {
    this.config.metricsBuffer.cleanup();
    this.config.asyncProcessor.forceCleanup();
  }

  public destroy(): void {
    this.config.components.systemProfiler.stop();
    if (this.config.circuitBreaker != null) {
      this.config.circuitBreaker.destroy();
    }
    this.config.metricsBuffer.destroy();
    this.config.asyncProcessor.destroy();
  }

  public getBudgetConfig() {
    return this.config.components.budgetOperations.getBudgetConfig();
  }

  public updateBudgetConfig(
    config: Parameters<
      typeof this.config.components.performanceBudget.updateConfig
    >[0]
  ) {
    this.config.components.budgetOperations.updateBudgetConfig(config);
  }

  public getBudgetViolations(
    severity?: 'warning' | 'critical',
    since?: number
  ) {
    return this.config.components.budgetOperations.getBudgetViolations(
      severity,
      since
    );
  }

  public getBudgetStatus() {
    return this.config.components.budgetOperations.getBudgetStatus();
  }

  public wrapSlowOperation<T extends (...args: unknown[]) => unknown>(
    fn: T,
    name: string,
    threshold?: number
  ): T {
    return this.config.components.budgetOperations.wrapSlowOperation(
      fn,
      name,
      threshold
    );
  }

  public async measureSlowAsync<T>(
    operation: () => Promise<T>,
    name: string,
    threshold?: number
  ): Promise<T> {
    return this.config.components.budgetOperations.measureSlowAsync(
      operation,
      name,
      threshold
    );
  }

  public measureSlow<T>(
    operation: () => T,
    name: string,
    threshold?: number
  ): T {
    return this.config.components.budgetOperations.measureSlow(
      operation,
      name,
      threshold
    );
  }

  public getSlowOperationReports(since?: number): SlowOperationReport[] {
    return this.config.components.budgetOperations.getSlowOperationReports(
      since
    );
  }

  public getSlowestOperations(count?: number): SlowOperationReport[] {
    return this.config.components.budgetOperations.getSlowestOperations(count);
  }
}
