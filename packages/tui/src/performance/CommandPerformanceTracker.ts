import type { PerformanceThreshold } from './helpers/AlertManager';
import type { PerformanceAlert, PerformanceMetric } from './types';

interface AlertManager {
  getThreshold: (name: string) => PerformanceThreshold | null;
  recordAlert: (alert: PerformanceAlert) => void;
}

interface MetricsTracker {
  recordMetric: (metric: PerformanceMetric) => void;
}

export class CommandPerformanceTracker {
  private alertManager: AlertManager;
  private metricsTracker: MetricsTracker;
  private emit: (event: string, data: unknown) => void;

  constructor(
    alertManager: AlertManager,
    metricsTracker: MetricsTracker,
    emit: (event: string, data: unknown) => void = () => {}
  ) {
    this.alertManager = alertManager;
    this.metricsTracker = metricsTracker;
    this.emit = emit;
  }

  public recordCommandExecution(commandId: string, duration: number): void {
    this.recordCommandMetric(commandId, duration);
    if (Boolean(this.alertManager)) {
      this.checkCommandAlert(commandId, duration);
    }
  }

  private recordCommandMetric(commandId: string, duration: number): void {
    const metric: PerformanceMetric = {
      id: `command-${Date.now()}`,
      name: 'command_execution_time',
      value: duration,
      timestamp: Date.now(),
      tags: { commandId },
      metadata: { commandId },
    };
    this.metricsTracker.recordMetric(metric);
  }

  private checkCommandAlert(commandId: string, duration: number): void {
    const threshold = this.alertManager.getThreshold('command_execution_time');
    if (!threshold || threshold.direction !== 'above') return;

    const level = this.determineAlertLevel(duration, threshold);
    if (!level) return;

    this.createCommandAlert(commandId, duration, threshold, level);
  }

  private determineAlertLevel(
    duration: number,
    threshold: { warningValue: number; criticalValue: number }
  ): 'warning' | 'critical' | null {
    if (duration >= threshold.criticalValue) return 'critical';
    if (duration >= threshold.warningValue) return 'warning';
    return null;
  }

  private createCommandAlert(
    commandId: string,
    duration: number,
    threshold: { warningValue: number; criticalValue: number },
    level: 'warning' | 'critical'
  ): void {
    const alert: PerformanceAlert = {
      id: `alert-${Date.now()}`,
      timestamp: Date.now(),
      metric: 'command_execution_time',
      value: duration,
      threshold:
        level === 'critical' ? threshold.criticalValue : threshold.warningValue,
      level,
      message: `Command '${commandId}' execution time is ${level}: ${duration}ms (threshold: ${level === 'critical' ? threshold.criticalValue : threshold.warningValue}ms)`,
    };
    this.alertManager.recordAlert(alert);
    this.emit('alert', alert);
  }
}
