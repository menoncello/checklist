import type {
  IPerformanceMonitor,
  PerformanceMetric,
  BudgetViolation,
  PerformanceReport,
  TimerHandle,
  PerformanceConfig,
} from '../interfaces/IPerformanceMonitor';
import { BaseService, type ServiceConfig } from '../services/BaseService';
import type { Logger } from '../utils/logger';

interface BudgetDefinition {
  maxMs: number;
  severity: 'warning' | 'critical';
}

interface MetricEntry {
  operation: string;
  duration: number;
  timestamp: number;
}

export class PerformanceMonitorService
  extends BaseService
  implements IPerformanceMonitor
{
  private metrics: Map<string, PerformanceMetric> = new Map();
  private budgets: Map<string, BudgetDefinition> = new Map();
  private rawMetrics: Map<string, MetricEntry[]> = new Map();
  private enabled: boolean = true;
  private bufferSize: number;
  private measurementStart: number;
  private timers: Set<NodeJS.Timeout> = new Set();

  constructor(
    config: ServiceConfig & { performance?: PerformanceConfig },
    logger: Logger
  ) {
    super(config, logger);

    const perfConfig =
      (config as ServiceConfig & { performance?: PerformanceConfig })
        .performance ?? {};
    this.enabled =
      (perfConfig as PerformanceConfig).enabled ??
      Bun.env.PERFORMANCE_MONITORING !== 'false';
    this.bufferSize = (perfConfig as PerformanceConfig).bufferSize ?? 1000;
    this.measurementStart = performance.now();

    // Set up default budgets for critical operations
    this.initializeDefaultBudgets();
  }

  protected async onInitialize(): Promise<void> {
    this.logger.debug({ msg: 'Initializing PerformanceMonitorService' });

    if (this.enabled) {
      this.logger.info({
        msg: 'Performance monitoring enabled',
        bufferSize: this.bufferSize,
      });
    } else {
      // Only log in non-test environments to prevent noise
      if (Bun.env.NODE_ENV !== 'test') {
        this.logger.info({ msg: 'Performance monitoring disabled' });
      }
    }
  }

  protected async onShutdown(): Promise<void> {
    this.logger.debug({ msg: 'Shutting down PerformanceMonitorService' });

    // Clear all timers
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();

    if (this.enabled) {
      await this.generateFinalReport();
    }
  }

  private initializeDefaultBudgets(): void {
    // Set budgets from the story requirements table
    const defaultBudgets: Record<string, BudgetDefinition> = {
      'command-execution': { maxMs: 100, severity: 'critical' },
      'application-startup': { maxMs: 500, severity: 'critical' },
      'template-parsing': { maxMs: 100, severity: 'critical' },
      'state-save': { maxMs: 50, severity: 'critical' },
      'state-load': { maxMs: 30, severity: 'critical' },
      'tui-frame-render': { maxMs: 16.67, severity: 'critical' },
      'file-system-operation': { maxMs: 50, severity: 'critical' },
      'checklist-navigation': { maxMs: 10, severity: 'warning' },
      'search-operation': { maxMs: 50, severity: 'warning' },
      'template-validation': { maxMs: 100, severity: 'warning' },
    };

    for (const [operation, budget] of Object.entries(defaultBudgets)) {
      this.budgets.set(operation, budget);
    }
  }

  startTimer(operation: string): TimerHandle {
    if (!this.enabled) {
      return () => {}; // No-op when disabled
    }

    const start = performance.now();

    return () => {
      const duration = performance.now() - start;
      this.recordMetric(operation, duration);
    };
  }

  recordMetric(operation: string, duration: number): void {
    if (!this.enabled) {
      return;
    }

    const rawEntries = this.updateRawMetrics(operation, duration);
    this.updateAggregatedMetrics(operation, duration, rawEntries);
    this.checkBudgetViolation(operation, duration);
  }

  private updateRawMetrics(operation: string, duration: number): MetricEntry[] {
    const rawEntries = this.rawMetrics.get(operation) ?? [];
    rawEntries.push({
      operation,
      duration,
      timestamp: performance.now(),
    });

    // Keep buffer size limited
    if (rawEntries.length > this.bufferSize) {
      rawEntries.shift(); // Remove oldest entry
    }

    this.rawMetrics.set(operation, rawEntries);
    return rawEntries;
  }

  private updateAggregatedMetrics(
    operation: string,
    duration: number,
    rawEntries: MetricEntry[]
  ): void {
    const metric = this.metrics.get(operation) ?? {
      count: 0,
      total: 0,
      min: Infinity,
      max: -Infinity,
      average: 0,
    };

    metric.count++;
    metric.total += duration;
    metric.min = Math.min(metric.min, duration);
    metric.max = Math.max(metric.max, duration);
    metric.average = metric.total / metric.count;

    this.calculatePercentiles(metric, rawEntries);
    this.metrics.set(operation, metric);
  }

  private calculatePercentiles(
    metric: PerformanceMetric,
    rawEntries: MetricEntry[]
  ): void {
    if (rawEntries.length < 10) {
      return;
    }

    const sortedDurations = rawEntries
      .map((e) => e.duration)
      .sort((a, b) => a - b);
    const p95Index = Math.ceil(sortedDurations.length * 0.95) - 1;
    const p99Index = Math.ceil(sortedDurations.length * 0.99) - 1;

    metric.p95 = sortedDurations[p95Index];
    metric.p99 = sortedDurations[p99Index];
  }

  private checkBudgetViolation(operation: string, duration: number): void {
    const budget = this.budgets.get(operation);
    if (budget !== undefined && duration > budget.maxMs) {
      this.handleBudgetExceeded(operation, duration, budget);
    }
  }

  setBudget(
    operation: string,
    maxMs: number,
    severity: 'warning' | 'critical' = 'warning'
  ): void {
    this.budgets.set(operation, { maxMs, severity });

    this.logger.debug({
      msg: 'Performance budget set',
      operation,
      budget: maxMs,
      severity,
    });
  }

  generateReport(): PerformanceReport {
    const violations = this.getBudgetViolations();
    const now = performance.now();

    return {
      metrics: Object.fromEntries(this.metrics),
      violations,
      summary: {
        totalOperations: this.metrics.size,
        budgetViolations: violations.length,
        overallHealth: this.determineOverallHealth(violations),
        measurementPeriod: {
          start: this.measurementStart,
          end: now,
          duration: now - this.measurementStart,
        },
      },
    };
  }

  clear(): void {
    this.metrics.clear();
    this.rawMetrics.clear();
    this.measurementStart = performance.now();

    this.logger.debug({ msg: 'Performance metrics cleared' });
  }

  getMetrics(operation: string): PerformanceMetric | undefined {
    return this.metrics.get(operation);
  }

  getBudgetViolations(): BudgetViolation[] {
    const violations: BudgetViolation[] = [];

    for (const [operation, metric] of this.metrics) {
      const budget = this.budgets.get(operation);
      if (budget && metric.max > budget.maxMs) {
        violations.push({
          operation,
          budget: budget.maxMs,
          actual: metric.max,
          exceedance: ((metric.max - budget.maxMs) / budget.maxMs) * 100,
          severity: budget.severity,
        });
      }
    }

    return violations.sort((a, b) => b.exceedance - a.exceedance);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    this.logger.info({
      msg: `Performance monitoring ${enabled ? 'enabled' : 'disabled'}`,
    });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private handleBudgetExceeded(
    operation: string,
    duration: number,
    budget: BudgetDefinition
  ): void {
    const exceedance = ((duration - budget.maxMs) / budget.maxMs) * 100;

    const logLevel = budget.severity === 'critical' ? 'warn' : 'debug';
    this.logger[logLevel]({
      msg: 'Performance budget exceeded',
      operation,
      budget: budget.maxMs,
      actual: duration,
      exceedance: Math.round(exceedance * 100) / 100,
      severity: budget.severity,
    });
  }

  private determineOverallHealth(
    violations: BudgetViolation[]
  ): 'HEALTHY' | 'DEGRADED' | 'CRITICAL' {
    if (violations.length === 0) {
      return 'HEALTHY';
    }

    const criticalViolations = violations.filter(
      (v) => v.severity === 'critical'
    );
    if (criticalViolations.length > 0) {
      return 'CRITICAL';
    }

    return 'DEGRADED';
  }

  private async generateFinalReport(): Promise<void> {
    const report = this.generateReport();

    this.logger.info({
      msg: 'Final performance report',
      totalOperations: report.summary.totalOperations,
      budgetViolations: report.summary.budgetViolations,
      overallHealth: report.summary.overallHealth,
      measurementDuration: Math.round(
        report.summary.measurementPeriod.duration
      ),
    });

    if (report.violations.length > 0) {
      this.logger.warn({
        msg: 'Performance budget violations detected',
        violations: report.violations.map((v) => ({
          operation: v.operation,
          budget: v.budget,
          actual: Math.round(v.actual * 100) / 100,
          exceedance: Math.round(v.exceedance * 100) / 100,
          severity: v.severity,
        })),
      });
    }
  }

  // Resource management for cleanup
  [Symbol.dispose](): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }
}

// Global performance monitor instance for easy access
let globalPerformanceMonitor: IPerformanceMonitor | null = null;

export function setGlobalPerformanceMonitor(
  monitor: IPerformanceMonitor
): void {
  globalPerformanceMonitor = monitor;
}

export function getGlobalPerformanceMonitor(): IPerformanceMonitor | null {
  return globalPerformanceMonitor;
}
