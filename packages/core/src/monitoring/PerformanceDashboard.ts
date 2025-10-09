import type {
  IPerformanceMonitor,
  PerformanceReport,
  BudgetViolation,
} from '../interfaces/IPerformanceMonitor';
import type { Logger } from '../utils/logger';
import { DashboardFormatters } from './DashboardFormatters';

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

    // CRITICAL: Disable dashboard during tests to prevent terminal interference
    const isTestEnvironment = Bun.env.NODE_ENV === 'test';

    this.config = {
      enabled: !isTestEnvironment && Bun.env.PERFORMANCE_DASHBOARD !== 'false',
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

    // CRITICAL: Skip terminal clear during tests to prevent interference
    if (Bun.env.NODE_ENV !== 'test') {
      process.stdout.write('\x1Bc');
    }
    this.logger.info({ msg: '🎯 Performance Dashboard' });
    this.displayTopOperations(report);
    this.displayViolations(report);
  }

  private displayTopOperations(report: PerformanceReport): void {
    const sortedMetrics = Object.entries(report.metrics)
      .sort(([, a], [, b]) => b.average - a.average)
      .slice(0, this.config.maxDisplayItems);

    this.logger.info({ msg: '📊 Top Operations (by avg duration):' });
    sortedMetrics.forEach(([operation, metric]) => {
      const status = DashboardFormatters.getMetricStatus(
        operation,
        metric,
        report.violations
      );
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

  private displayTableReport(report: PerformanceReport): void {
    if (Object.keys(report.metrics).length === 0) {
      return;
    }

    // CRITICAL: Skip terminal clear during tests to prevent interference
    if (Bun.env.NODE_ENV !== 'test') {
      process.stdout.write('\x1Bc');
    }
    this.logger.info({ msg: '🎯 Performance Dashboard - Table View' });
    this.displayMetricsTable(report);
    this.displayViolationsTable(report.violations);
  }

  private displayMetricsTable(report: PerformanceReport): void {
    const tableData = DashboardFormatters.createMetricsTableData(report);
    // Use logger structured output for table data
    this.logger.info({ msg: 'Performance metrics table', table: tableData });
  }

  private displayViolationsTable(violations: BudgetViolation[]): void {
    if (violations.length === 0) {
      return;
    }

    const tableData = DashboardFormatters.createViolationsTableData(violations);
    this.logger.warn({ msg: '⚠️  Budget Violations:' });
    // Use logger structured output for violations table
    this.logger.warn({ msg: 'Budget violations table', violations: tableData });
  }

  private displayJsonReport(report: PerformanceReport): void {
    // CRITICAL: Skip terminal clear during tests to prevent interference
    if (Bun.env.NODE_ENV !== 'test') {
      process.stdout.write('\x1Bc');
    }
    this.logger.info({ msg: '🎯 Performance Dashboard - JSON View' });
    this.logger.info({ msg: 'Performance report', report });
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

    const lines = DashboardFormatters.createSummaryHeader(report);
    DashboardFormatters.addViolationsToSummary(lines, report);
    DashboardFormatters.addTopOperationsToSummary(lines, report);

    return lines.join('\n');
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
