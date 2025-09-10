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
      this.alertViolations(report.violations);
    }

    this.lastReport = report;
  }

  private displayConsoleReport(report: PerformanceReport): void {
    if (Object.keys(report.metrics).length === 0) {
      return; // No metrics to display
    }

    /* eslint-disable no-console */
    console.clear();
    console.log('🎯 Performance Dashboard');
    console.log('='.repeat(60));
    console.log(
      `Health: ${this.getHealthEmoji(report.summary.overallHealth)} ${report.summary.overallHealth}`
    );
    console.log(`Operations: ${report.summary.totalOperations}`);
    console.log(`Violations: ${report.summary.budgetViolations}`);
    console.log(
      `Duration: ${Math.round(report.summary.measurementPeriod.duration)}ms`
    );
    console.log('');

    // Display top operations by average duration
    const sortedMetrics = Object.entries(report.metrics)
      .sort(([, a], [, b]) => b.average - a.average)
      .slice(0, this.config.maxDisplayItems);

    console.log('📊 Top Operations (by avg duration):');
    console.log('-'.repeat(60));

    sortedMetrics.forEach(([operation, metric]) => {
      const avgMs = metric.average.toFixed(2);
      const maxMs = metric.max.toFixed(2);
      const count = metric.count;
      const status = this.getMetricStatus(operation, metric, report.violations);

      console.log(
        `${status} ${operation.padEnd(30)} ${avgMs}ms avg (max: ${maxMs}ms, n=${count})`
      );
    });

    // Display violations if any
    if (report.violations.length > 0) {
      console.log('');
      console.log('⚠️  Budget Violations:');
      console.log('-'.repeat(60));

      report.violations.forEach((violation) => {
        const severity = violation.severity === 'critical' ? '🔴' : '🟡';
        console.log(
          `${severity} ${violation.operation}: ${violation.actual.toFixed(2)}ms (budget: ${violation.budget}ms, +${violation.exceedance.toFixed(1)}%)`
        );
      });
    }

    console.log('');
    console.log(`Last updated: ${new Date().toLocaleTimeString()}`);
    /* eslint-enable no-console */
  }

  private displayTableReport(report: PerformanceReport): void {
    if (Object.keys(report.metrics).length === 0) {
      return;
    }

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

    /* eslint-disable no-console */
    console.clear();
    console.log('🎯 Performance Dashboard - Table View');
    console.log('='.repeat(80));
    console.table(tableData);

    if (report.violations.length > 0) {
      console.log('⚠️  Violations:');
      console.table(
        report.violations.map((v) => ({
          Operation: v.operation,
          Budget: `${v.budget}ms`,
          Actual: `${v.actual.toFixed(2)}ms`,
          Exceedance: `+${v.exceedance.toFixed(1)}%`,
          Severity: v.severity,
        }))
      );
    }
    /* eslint-enable no-console */
  }

  private displayJsonReport(report: PerformanceReport): void {
    /* eslint-disable no-console */
    console.clear();
    console.log('🎯 Performance Dashboard - JSON View');
    console.log('='.repeat(60));
    console.log(JSON.stringify(report, null, 2));
    /* eslint-enable no-console */
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

    return report.violations.length > this.lastReport.violations.length;
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

    const lines = [
      `Performance Summary (${report.summary.overallHealth})`,
      `Total Operations: ${report.summary.totalOperations}`,
      `Budget Violations: ${report.summary.budgetViolations}`,
      `Measurement Duration: ${Math.round(report.summary.measurementPeriod.duration)}ms`,
    ];

    if (report.violations.length > 0) {
      lines.push('');
      lines.push('Budget Violations:');
      report.violations.forEach((violation) => {
        lines.push(
          `  - ${violation.operation}: ${violation.actual.toFixed(2)}ms (budget: ${violation.budget}ms)`
        );
      });
    }

    const topOperations = Object.entries(report.metrics)
      .sort(([, a], [, b]) => b.average - a.average)
      .slice(0, 5);

    if (topOperations.length > 0) {
      lines.push('');
      lines.push('Top Operations (by avg duration):');
      topOperations.forEach(([operation, metric]) => {
        lines.push(
          `  - ${operation}: ${metric.average.toFixed(2)}ms avg (${metric.count} calls)`
        );
      });
    }

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
