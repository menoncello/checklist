import type {
  PerformanceReport,
  PerformanceMetric,
  BudgetViolation,
} from '../interfaces/IPerformanceMonitor';

/**
 * Helper functions for formatting dashboard reports
 */
export class DashboardFormatters {
  static getHealthEmoji(health: string): string {
    switch (health) {
      case 'HEALTHY':
        return '✅';
      case 'DEGRADED':
        return '⚠️';
      case 'CRITICAL':
        return '🔴';
      default:
        return '❓';
    }
  }

  static getMetricStatus(
    operation: string,
    metric: PerformanceMetric,
    violations: BudgetViolation[]
  ): string {
    const violation = violations.find((v) => v.operation === operation);
    if (violation) {
      return violation.severity === 'critical' ? '🔴' : '🟡';
    }
    return '✅';
  }

  static getMetricStatusText(
    operation: string,
    metric: PerformanceMetric,
    violations: BudgetViolation[]
  ): string {
    const violation = violations.find((v) => v.operation === operation);
    if (violation) {
      return violation.severity === 'critical' ? 'CRITICAL' : 'WARNING';
    }
    return 'OK';
  }

  static createSummaryHeader(report: PerformanceReport): string[] {
    return [
      `Performance Summary (${report.summary.overallHealth})`,
      `Total Operations: ${report.summary.totalOperations}`,
      `Budget Violations: ${report.summary.budgetViolations}`,
      `Measurement Duration: ${Math.round(report.summary.measurementPeriod.duration)}ms`,
    ];
  }

  static addViolationsToSummary(
    lines: string[],
    report: PerformanceReport
  ): void {
    if (report.violations.length === 0) {
      return;
    }

    lines.push('', 'Budget Violations:');
    report.violations.forEach((violation) => {
      lines.push(
        `  - ${violation.operation}: ${violation.actual.toFixed(2)}ms (budget: ${violation.budget}ms)`
      );
    });
  }

  static addTopOperationsToSummary(
    lines: string[],
    report: PerformanceReport
  ): void {
    const topOperations = Object.entries(report.metrics)
      .sort(([, a], [, b]) => b.average - a.average)
      .slice(0, 5);

    if (topOperations.length === 0) {
      return;
    }

    lines.push('', 'Top Operations (by avg duration):');
    topOperations.forEach(([operation, metric]) => {
      lines.push(
        `  - ${operation}: ${metric.average.toFixed(2)}ms avg (${metric.count} calls)`
      );
    });
  }

  static createMetricsTableData(report: PerformanceReport): Array<{
    Operation: string;
    'Avg (ms)': string;
    'Min (ms)': string;
    'Max (ms)': string;
    'P95 (ms)': string;
    Count: number;
    Status: string;
  }> {
    return Object.entries(report.metrics).map(([operation, metric]) => ({
      Operation: operation,
      'Avg (ms)': metric.average.toFixed(2),
      'Min (ms)': metric.min.toFixed(2),
      'Max (ms)': metric.max.toFixed(2),
      'P95 (ms)': metric.p95?.toFixed(2) ?? 'N/A',
      Count: metric.count,
      Status: DashboardFormatters.getMetricStatusText(
        operation,
        metric,
        report.violations
      ),
    }));
  }

  static createViolationsTableData(violations: BudgetViolation[]): Array<{
    Operation: string;
    Budget: string;
    Actual: string;
    Exceedance: string;
    Severity: string;
  }> {
    return violations.map((v) => ({
      Operation: v.operation,
      Budget: `${v.budget}ms`,
      Actual: `${v.actual.toFixed(2)}ms`,
      Exceedance: `+${v.exceedance.toFixed(1)}%`,
      Severity: v.severity,
    }));
  }
}
