export interface PerformanceMetric {
  count: number;
  total: number;
  min: number;
  max: number;
  average: number;
  p95?: number;
  p99?: number;
}

export interface BudgetViolation {
  operation: string;
  budget: number;
  actual: number;
  exceedance: number;
  severity: 'warning' | 'critical';
}

export interface PerformanceReport {
  metrics: Record<string, PerformanceMetric>;
  violations: BudgetViolation[];
  summary: {
    totalOperations: number;
    budgetViolations: number;
    overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
    measurementPeriod: {
      start: number;
      end: number;
      duration: number;
    };
  };
  trends?: {
    operation: string;
    trendDirection: 'improving' | 'degrading' | 'stable';
    changePercent: number;
  }[];
}

export interface TimerHandle {
  (): void;
}

export interface PerformanceConfig {
  enabled: boolean;
  bufferSize?: number;
  reportingInterval?: number;
  enableTrends?: boolean;
  alertThresholds?: {
    warning: number;
    critical: number;
  };
}

export interface IPerformanceMonitor {
  /**
   * Start timing an operation
   */
  startTimer(operation: string): TimerHandle;

  /**
   * Record a performance metric manually
   */
  recordMetric(operation: string, duration: number): void;

  /**
   * Set performance budget for an operation
   */
  setBudget(
    operation: string,
    maxMs: number,
    severity?: 'warning' | 'critical'
  ): void;

  /**
   * Generate performance report
   */
  generateReport(): PerformanceReport;

  /**
   * Clear all metrics (useful for testing)
   */
  clear(): void;

  /**
   * Get metrics for a specific operation
   */
  getMetrics(operation: string): PerformanceMetric | undefined;

  /**
   * Get all budget violations
   */
  getBudgetViolations(): BudgetViolation[];

  /**
   * Enable/disable performance monitoring
   */
  setEnabled(enabled: boolean): void;

  /**
   * Check if performance monitoring is enabled
   */
  isEnabled(): boolean;
}
