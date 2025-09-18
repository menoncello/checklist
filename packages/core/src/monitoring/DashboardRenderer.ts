import type {
  PerformanceReport,
  BudgetViolation,
} from '../interfaces/IPerformanceMonitor';
import type { Logger } from '../utils/logger';

/**
 * Base class for dashboard renderers
 */
export abstract class DashboardRenderer {
  constructor(protected logger: Logger) {}

  abstract render(report: PerformanceReport): void;

  protected formatDuration(ms: number): string {
    if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  protected formatMemory(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)}MB`;
  }

  protected getTrend(current: number, previous?: number): string {
    if (previous === undefined || previous === 0) return '';
    const diff = ((current - previous) / previous) * 100;
    if (diff > 5) return '↑';
    if (diff < -5) return '↓';
    return '→';
  }
}

/**
 * Console renderer for dashboard
 */
export class ConsoleRenderer extends DashboardRenderer {
  render(report: PerformanceReport): void {
    this.displayHeader(report);
    this.displayTopOperations(report);
    this.displayViolations(report);
    this.displayFooter();
  }

  private displayHeader(report: PerformanceReport): void {
    this.logger.info({ msg: '\x1b[2J\x1b[H' }); // Clear screen
    this.logger.info({
      msg: '╔══════════════════════════════════════════════════════════╗',
    });
    this.logger.info({
      msg: '║           Performance Dashboard - Live Monitor           ║',
    });
    this.logger.info({
      msg: '╠══════════════════════════════════════════════════════════╣',
    });

    const memUsage = process.memoryUsage();
    this.logger.info({
      msg: `║ Memory: ${this.formatMemory(memUsage.heapUsed)} / ${this.formatMemory(memUsage.heapTotal)}`,
    });

    // Use summary values if available
    const totalOps = report.summary?.totalOperations ?? 0;
    const activeOps = Object.keys(report.metrics).length;

    this.logger.info({ msg: `║ Total Operations: ${totalOps}` });
    this.logger.info({ msg: `║ Active Operations: ${activeOps}` });
    this.logger.info({
      msg: '╚══════════════════════════════════════════════════════════╝',
    });
  }

  private displayTopOperations(report: PerformanceReport): void {
    this.logger.info({ msg: '\n📊 Top Operations by Average Duration:' });

    // Calculate average durations from metrics
    if (typeof report.metrics === 'object' && report.metrics !== null) {
      const avgDurations: Record<string, number> = {};
      Object.entries(report.metrics).forEach(([name, metric]) => {
        if (metric.count > 0) {
          avgDurations[name] = metric.total / metric.count;
        }
      });
      const topOps = Object.entries(avgDurations)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

      this.displayOperationsList(topOps);
      return;
    }

    this.logger.info({ msg: '  No operations data available' });
  }

  private displayOperationsList(operations: Array<[string, number]>): void {
    operations.forEach(([name, duration]) => {
      this.logger.info({
        msg: `  • ${name}: ${this.formatDuration(duration)}`,
      });
    });
  }

  private displayViolations(report: PerformanceReport): void {
    if (report.violations.length > 0) {
      this.logger.info({ msg: '\n⚠️  Budget Violations:' });
      report.violations.forEach((violation) => {
        this.logger.info({
          msg: `  • ${violation.operation}: ${this.formatDuration(violation.actual)} > ${this.formatDuration(violation.budget)}`,
        });
      });
    }
  }

  private displayFooter(): void {
    this.logger.info({
      msg: '\n════════════════════════════════════════════════════════════',
    });
    this.logger.info({
      msg: `Last updated: ${new Date().toLocaleTimeString()}`,
    });
  }
}

/**
 * Table renderer for dashboard
 */
export class TableRenderer extends DashboardRenderer {
  render(report: PerformanceReport): void {
    this.displayTableHeader();
    this.displayMetricsTable(report);

    if (report.violations.length > 0) {
      this.displayViolationsTable(report.violations);
    }
  }

  private displayTableHeader(): void {
    this.logger.info({ msg: '\x1b[2J\x1b[H' }); // Clear screen
    this.logger.info({ msg: 'Performance Dashboard - Table View' });
    this.logger.info({ msg: '═'.repeat(80) });
  }

  private displayMetricsTable(report: PerformanceReport): void {
    this.logger.info({ msg: '\nMetrics Overview:' });
    this.logger.info({
      msg: 'Metrics Table',
      data: {
        'Total Operations': report.summary?.totalOperations ?? 0,
        'Active Operations': Object.keys(report.metrics).length,
        'Memory (MB)': (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(
          2
        ),
        Violations: report.violations.length,
      },
    });

    this.logger.info({ msg: '\nTop Operations:' });
    const tableData = Object.entries(report.metrics)
      .slice(0, 10)
      .map(([name, metric]) => ({
        Operation: name,
        'Avg Duration': this.formatDuration(metric.average),
        Calls: metric.count,
      }));

    this.logger.info({ msg: 'Operations Table', data: tableData });
  }

  private displayViolationsTable(violations: BudgetViolation[]): void {
    this.logger.info({ msg: '\nBudget Violations:' });
    const violationData = violations.map((v) => ({
      Operation: v.operation,
      Actual: this.formatDuration(v.actual),
      Budget: this.formatDuration(v.budget),
      Severity: v.severity,
    }));

    this.logger.info({ msg: 'Violations Table', data: violationData });
  }
}

/**
 * JSON renderer for dashboard
 */
export class JsonRenderer extends DashboardRenderer {
  render(report: PerformanceReport): void {
    const summary = {
      timestamp: new Date().toISOString(),
      totalOperations: report.summary?.totalOperations ?? 0,
      activeOperations: Object.keys(report.metrics).length,
      memory: process.memoryUsage(),
      topOperations: Object.entries(report.metrics)
        .slice(0, 10)
        .map(([name, metric]) => ({
          name,
          avgDuration: metric.average,
          calls: metric.count,
        })),
      violations: report.violations,
    };

    this.logger.info({ msg: JSON.stringify(summary, null, 2) });
  }
}
