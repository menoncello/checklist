import { createLogger } from '@checklist/core/utils/logger';

import type { PerformanceMetric } from './helpers/MetricsTracker';

const logger = createLogger('checklist:tui:performance-budget');

export interface PerformanceBudgetConfig {
  renderTime: number; // ms
  memoryBaseline: number; // bytes
  memoryDelta: number; // bytes
  cpuUsage: number; // percentage
  startupTime: number; // ms
  responseTime: number; // ms
  frameRate: number; // fps minimum
}

export interface BudgetViolation {
  metric: string;
  actual: number;
  budget: number;
  severity: 'warning' | 'critical';
  timestamp: number;
  details?: Record<string, unknown>;
}

export class PerformanceBudget {
  private config: PerformanceBudgetConfig;
  private violations: BudgetViolation[] = [];
  private readonly maxViolations = 100;
  private eventHandlers = new Map<string, Set<Function>>();

  constructor(config?: Partial<PerformanceBudgetConfig>) {
    this.config = {
      renderTime: 50, // 50ms max render time
      memoryBaseline: 52428800, // 50MB baseline
      memoryDelta: 10485760, // 10MB delta
      cpuUsage: 80, // 80% max CPU
      startupTime: 100, // 100ms startup
      responseTime: 50, // 50ms response
      frameRate: 30, // 30fps minimum
      ...config,
    };

    logger.info({
      msg: 'Performance budget initialized',
      budget: this.config,
    });
  }

  checkMetric(metric: PerformanceMetric): BudgetViolation | null {
    const violation = this.evaluateMetric(metric);

    if (violation != null) {
      this.recordViolation(violation);
      this.emit('violation', violation);

      logger.warn({
        msg: 'Performance budget violated',
        metric: violation.metric,
        actual: violation.actual,
        budget: violation.budget,
        severity: violation.severity,
      });
    }

    return violation;
  }

  private evaluateMetric(metric: PerformanceMetric): BudgetViolation | null {
    const { name, value, timestamp } = metric;
    const checkers: Record<string, () => BudgetViolation | null> = {
      'render.time': () => this.checkRenderTime(value, timestamp),
      'memory.usage': () => this.checkMemoryUsage(value, timestamp),
      'memory.delta': () => this.checkMemoryDelta(value, timestamp),
      'cpu.usage': () => this.checkCpuUsage(value, timestamp),
      'startup.time': () => this.checkStartupTime(value, timestamp),
      'response.time': () => this.checkResponseTime(value, timestamp),
      'frame.rate': () => this.checkFrameRate(value, timestamp),
    };

    const checker = checkers[name];
    return checker != null ? checker() : null;
  }

  private checkRenderTime(
    value: number,
    timestamp?: number
  ): BudgetViolation | null {
    if (value > this.config.renderTime) {
      return this.createViolation('renderTime', value, this.config.renderTime, {
        severity: value > this.config.renderTime * 1.5 ? 'critical' : 'warning',
        timestamp,
      });
    }
    return null;
  }

  private checkMemoryUsage(
    value: number,
    timestamp?: number
  ): BudgetViolation | null {
    if (value > this.config.memoryBaseline) {
      return this.createViolation(
        'memoryBaseline',
        value,
        this.config.memoryBaseline,
        {
          severity:
            value > this.config.memoryBaseline * 1.5 ? 'critical' : 'warning',
          timestamp,
        }
      );
    }
    return null;
  }

  private checkMemoryDelta(
    value: number,
    timestamp?: number
  ): BudgetViolation | null {
    if (value > this.config.memoryDelta) {
      return this.createViolation(
        'memoryDelta',
        value,
        this.config.memoryDelta,
        { severity: 'critical', timestamp }
      );
    }
    return null;
  }

  private checkCpuUsage(
    value: number,
    timestamp?: number
  ): BudgetViolation | null {
    if (value > this.config.cpuUsage) {
      return this.createViolation('cpuUsage', value, this.config.cpuUsage, {
        severity: value > 90 ? 'critical' : 'warning',
        timestamp,
      });
    }
    return null;
  }

  private checkStartupTime(
    value: number,
    timestamp?: number
  ): BudgetViolation | null {
    if (value > this.config.startupTime) {
      return this.createViolation(
        'startupTime',
        value,
        this.config.startupTime,
        { severity: 'warning', timestamp }
      );
    }
    return null;
  }

  private checkResponseTime(
    value: number,
    timestamp?: number
  ): BudgetViolation | null {
    if (value > this.config.responseTime) {
      return this.createViolation(
        'responseTime',
        value,
        this.config.responseTime,
        {
          severity:
            value > this.config.responseTime * 2 ? 'critical' : 'warning',
          timestamp,
        }
      );
    }
    return null;
  }

  private checkFrameRate(
    value: number,
    timestamp?: number
  ): BudgetViolation | null {
    if (value < this.config.frameRate) {
      return this.createViolation('frameRate', value, this.config.frameRate, {
        severity: value < this.config.frameRate / 2 ? 'critical' : 'warning',
        timestamp,
      });
    }
    return null;
  }

  private createViolation(
    metric: string,
    actual: number,
    budget: number,
    severityAndTimestamp: {
      severity: 'warning' | 'critical';
      timestamp?: number;
    }
  ): BudgetViolation {
    return {
      metric,
      actual,
      budget,
      severity: severityAndTimestamp.severity,
      timestamp: severityAndTimestamp.timestamp ?? Date.now(),
    };
  }

  private recordViolation(violation: BudgetViolation): void {
    this.violations.push(violation);

    // Keep violations buffer from growing too large
    if (this.violations.length > this.maxViolations) {
      this.violations.shift();
    }
  }

  getViolations(
    severity?: 'warning' | 'critical',
    since?: number
  ): BudgetViolation[] {
    let violations = [...this.violations];

    if (severity != null) {
      violations = violations.filter((v) => v.severity === severity);
    }

    if (since != null) {
      violations = violations.filter((v) => v.timestamp >= since);
    }

    return violations;
  }

  getConfig(): PerformanceBudgetConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<PerformanceBudgetConfig>): void {
    this.config = { ...this.config, ...newConfig };

    logger.info({
      msg: 'Performance budget updated',
      budget: this.config,
    });

    this.emit('configUpdated', this.config);
  }

  clearViolations(): void {
    this.violations = [];
    this.emit('violationsCleared');
  }

  getStatus(): {
    hasViolations: boolean;
    criticalCount: number;
    warningCount: number;
    recentViolations: BudgetViolation[];
  } {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const recentViolations = this.violations.filter(
      (v) => v.timestamp >= fiveMinutesAgo
    );

    return {
      hasViolations: this.violations.length > 0,
      criticalCount: this.violations.filter((v) => v.severity === 'critical')
        .length,
      warningCount: this.violations.filter((v) => v.severity === 'warning')
        .length,
      recentViolations,
    };
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.add(handler);
    }
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          logger.error({
            msg: 'Error in budget event handler',
            event,
            error,
          });
        }
      });
    }
  }
}
