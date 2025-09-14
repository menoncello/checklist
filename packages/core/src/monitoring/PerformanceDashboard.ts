import type {
  IPerformanceMonitor,
  PerformanceReport,
  PerformanceMetric,
  BudgetViolation,
} from '../interfaces/IPerformanceMonitor';
import type { Logger } from '../utils/logger';

/**
 * Performance dashboard configuration
 */
export interface DashboardConfig {
  enabled: boolean;
  refreshInterval: number; // ms
  displayMode: 'console' | 'table' | 'json';
  showTrends: boolean;
  maxDisplayItems: number;
  alertOnViolations: boolean;
}

/**
 * Performance dashboard for development mode monitoring
 */
export class PerformanceDashboard {
  private performanceMonitor: IPerformanceMonitor;
  private logger: Logger;
  private config: DashboardConfig;
  private refreshTimer: NodeJS.Timeout | null = null;
  private lastReport: PerformanceReport | null = null;

  constructor(
    performanceMonitor: IPerformanceMonitor,
    logger: Logger,
    config: Partial<DashboardConfig> = {}
  ) {
    this.performanceMonitor = performanceMonitor;
    this.logger = logger;

    this.config = {
      enabled: Bun.env.PERFORMANCE_DASHBOARD !== 'false',
      refreshInterval: Number(Bun.env.DASHBOARD_REFRESH_INTERVAL) || 5000,
      displayMode:
        (Bun.env.DASHBOARD_DISPLAY_MODE as 'console' | 'table' | 'json') ??
        'console',
      showTrends: Bun.env.DASHBOARD_SHOW_TRENDS === 'true',
      maxDisplayItems: Number(Bun.env.DASHBOARD_MAX_ITEMS) || 20,
      alertOnViolations: Bun.env.DASHBOARD_ALERT_ON_VIOLATIONS !== 'false',
      ...config,
    };
  }

  start(): void {
    if (!this.config.enabled || !this.performanceMonitor.isEnabled()) {
      this.logger.debug({ msg: 'Performance dashboard disabled' });
      return;
    }

    this.logger.info({
      msg: 'Starting performance dashboard',
      refreshInterval: this.config.refreshInterval,
      displayMode: this.config.displayMode,
    });

    // Initial display
    this.displayReport();

    // Set up refresh timer
    this.refreshTimer = setInterval(() => {
      this.displayReport();
    }, this.config.refreshInterval);
  }

  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.logger.debug({ msg: 'Performance dashboard stopped' });
  }

  displayReport(): void {
    if (!this.performanceMonitor.isEnabled()) {
      return;
    }

    const report = this.performanceMonitor.generateReport();

    switch (this.config.displayMode) {
      case 'console':
        this.displayConsoleReport(report);
        break;
      case 'table':
        this.displayTableReport(report);
        break;
      case 'json':
        this.displayJsonReport(report);
        break;
    }

    // Alert on new violations
    if (this.config.alertOnViolations && this.hasNewViolations(report)) {
      this.alertNewViolations(report);
    }

    this.lastReport = report;
  }

  private displayConsoleReport(report: PerformanceReport): void {
    if (Object.keys(report.metrics).length === 0) {
      return; // No metrics to display
    }

    // Clear terminal display is intentional for dashboard
    process.stdout.write('\x1Bc');
    this.logger.info({ msg: '🎯 Performance Dashboard' });
    this.displayTopOperations(report);
    this.displayViolations(report);
  }

  private displayHeader(report: PerformanceReport): void {
    this.logger.info({
      msg: '🎯 Performance Dashboard',
      health: report.summary.overallHealth,
      totalOperations: report.summary.totalOperations,
      budgetViolations: report.summary.budgetViolations,
      measurementDuration: Math.round(
        report.summary.measurementPeriod.duration
      ),
    });
  }

  private displayTopOperations(report: PerformanceReport): void {
    const sortedMetrics = Object.entries(report.metrics)
      .sort(([, a], [, b]) => b.average - a.average)
      .slice(0, this.config.maxDisplayItems);

    this.logger.info({ msg: '📊 Top Operations (by avg duration):' });
    sortedMetrics.forEach(([operation, metric]) => {
      const status = this.getMetricStatus(operation, metric, report.violations);
      this.logger.info({
        msg: `  ${status} ${operation}: ${metric.average.toFixed(2)}ms avg (${metric.count} calls, max: ${metric.max.toFixed(2)}ms)`,
      });
    });
  }

  private displayViolations(report: PerformanceReport): void {
    if (report.violations.length === 0) {
      return;
    }

    // Log violations for visibility
    this.logger.warn({ msg: '⚠️  Budget Violations:' });
    report.violations.forEach((violation) => {
      this.logger.warn({
        msg: `  - ${violation.operation}: ${violation.actual.toFixed(2)}ms (budget: ${violation.budget}ms) [${violation.severity}]`,
      });
    });
  }

  private displayFooter(): void {
    this.logger.debug({
      msg: 'Performance dashboard footer',
      lastUpdated: new Date().toLocaleTimeString(),
    });
  }

  private displayTableReport(report: PerformanceReport): void {
    if (Object.keys(report.metrics).length === 0) {
      return;
    }

    // Clear terminal display is intentional for dashboard
    process.stdout.write('\x1Bc');
    this.logger.info({ msg: '🎯 Performance Dashboard - Table View' });
    this.displayMetricsTable(report);
    this.displayViolationsTable(report.violations);
  }

  private displayTableHeader(): void {
    this.logger.info({
      msg: '🎯 Performance Dashboard - Table View',
    });
  }

  private displayMetricsTable(report: PerformanceReport): void {
    const tableData = Object.entries(report.metrics).map(
      ([operation, metric]) => ({
        Operation: operation,
        'Avg (ms)': metric.average.toFixed(2),
        'Min (ms)': metric.min.toFixed(2),
        'Max (ms)': metric.max.toFixed(2),
        'P95 (ms)': metric.p95?.toFixed(2) ?? 'N/A',
        Count: metric.count,
        Status: this.getMetricStatusText(operation, metric, report.violations),
      })
    );

    // Use logger structured output for table data
    this.logger.info({ msg: 'Performance metrics table', table: tableData });
  }

  private displayViolationsTable(violations: BudgetViolation[]): void {
    if (violations.length === 0) {
      return;
    }

    const tableData = violations.map((v) => ({
      Operation: v.operation,
      Budget: `${v.budget}ms`,
      Actual: `${v.actual.toFixed(2)}ms`,
      Exceedance: `+${v.exceedance.toFixed(1)}%`,
      Severity: v.severity,
    }));

    this.logger.warn({ msg: '⚠️  Budget Violations:' });
    // Use logger structured output for violations table
    this.logger.warn({ msg: 'Budget violations table', violations: tableData });
  }

  private displayJsonReport(report: PerformanceReport): void {
    // Clear terminal display is intentional for dashboard
    process.stdout.write('\x1Bc');
    this.logger.info({ msg: '🎯 Performance Dashboard - JSON View' });
    this.logger.info({ msg: 'Performance report', report });
  }

  private getHealthEmoji(health: string): string {
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

  private getMetricStatus(
    operation: string,
    metric: PerformanceMetric,
    violations: BudgetViolation[]
  ): string {
    const violation = violations.find((v) => v.operation === operation);
    if (violation) {
      return violation.severity === 'critical' ? '🔴' : '🟡';
    }

    // Green if performance looks good
    return '✅';
  }

  private getMetricStatusText(
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

  private hasNewViolations(report: PerformanceReport): boolean {
    if (!this.lastReport) {
      return report.violations.length > 0;
    }

    // Check for new violations by comparing operations
    const lastViolationOperations = this.lastReport.violations.map(
      (v) => v.operation
    );
    const newViolations = report.violations.filter(
      (v) => !lastViolationOperations.includes(v.operation)
    );

    return newViolations.length > 0;
  }

  private alertNewViolations(report: PerformanceReport): void {
    if (!this.lastReport) {
      // First report - alert on all violations
      this.alertViolations(report.violations);
      return;
    }

    // Check for new violations by comparing operations
    const lastViolationOperations = this.lastReport.violations.map(
      (v) => v.operation
    );
    const newViolations = report.violations.filter(
      (v) => !lastViolationOperations.includes(v.operation)
    );

    // Alert each new violation
    this.alertViolations(newViolations);
  }

  private alertViolations(violations: BudgetViolation[]): void {
    violations.forEach((violation) => {
      const level = violation.severity === 'critical' ? 'error' : 'warn';
      this.logger[level]({
        msg: 'Performance budget violation detected',
        operation: violation.operation,
        budget: violation.budget,
        actual: violation.actual,
        exceedance: violation.exceedance,
        severity: violation.severity,
      });
    });
  }

  // Utility method to create a formatted performance summary
  createSummary(): string {
    const report = this.performanceMonitor.generateReport();

    if (Object.keys(report.metrics).length === 0) {
      return 'No performance metrics available';
    }

    const lines = this.createSummaryHeader(report);
    this.addViolationsToSummary(lines, report);
    this.addTopOperationsToSummary(lines, report);

    return lines.join('\n');
  }

  private createSummaryHeader(report: PerformanceReport): string[] {
    return [
      `Performance Summary (${report.summary.overallHealth})`,
      `Total Operations: ${report.summary.totalOperations}`,
      `Budget Violations: ${report.summary.budgetViolations}`,
      `Measurement Duration: ${Math.round(report.summary.measurementPeriod.duration)}ms`,
    ];
  }

  private addViolationsToSummary(
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

  private addTopOperationsToSummary(
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

  // Cleanup method
  [Symbol.dispose](): void {
    this.stop();
  }
}

/**
 * Utility function to create a development dashboard
 */
export function createDevelopmentDashboard(
  performanceMonitor: IPerformanceMonitor,
  logger: Logger,
  config?: Partial<DashboardConfig>
): PerformanceDashboard {
  const isDevelopment =
    Bun.env.NODE_ENV === 'development' || Bun.env.NODE_ENV === undefined;

  const dashboardConfig: Partial<DashboardConfig> = {
    enabled: isDevelopment,
    refreshInterval: 10000, // 10 seconds in development
    displayMode: 'console',
    showTrends: true,
    alertOnViolations: true,
    ...config,
  };

  return new PerformanceDashboard(performanceMonitor, logger, dashboardConfig);
}
