import { MetricAlert, AlertRule, MetricPoint } from './types';

export class AlertManager {
  private alerts: MetricAlert[] = [];
  private alertRules = new Map<string, AlertRule>();
  private maxAlerts: number;

  constructor(maxAlerts: number = 100) {
    this.maxAlerts = maxAlerts;
    this.setupDefaultAlertRules();
  }

  private setupDefaultAlertRules(): void {
    const rules = this.getDefaultRules();
    for (const rule of rules) {
      this.alertRules.set(rule.metric, rule);
    }
  }

  private getDefaultRules(): AlertRule[] {
    return [
      this.createMemoryRule(),
      this.createCpuRule(),
      this.createResponseTimeRule(),
      this.createErrorRateRule(),
      this.createDiskUsageRule(),
    ];
  }

  private createMemoryRule(): AlertRule {
    return {
      id: 'memory-usage',
      metric: 'memory.usage',
      threshold: 100 * 1024 * 1024, // 100MB
      operator: '>',
      severity: 'medium',
      message: 'High memory usage detected',
    };
  }

  private createCpuRule(): AlertRule {
    return {
      id: 'cpu-usage',
      metric: 'cpu.usage',
      threshold: 80,
      operator: '>',
      severity: 'high',
      message: 'High CPU usage detected',
    };
  }

  private createResponseTimeRule(): AlertRule {
    return {
      id: 'response-time',
      metric: 'response.time',
      threshold: 1000,
      operator: '>',
      severity: 'medium',
      message: 'Slow response time detected',
    };
  }

  private createErrorRateRule(): AlertRule {
    return {
      id: 'error-rate',
      metric: 'error.rate',
      threshold: 5,
      operator: '>',
      severity: 'critical',
      message: 'High error rate detected',
    };
  }

  private createDiskUsageRule(): AlertRule {
    return {
      id: 'disk-usage',
      metric: 'disk.usage',
      threshold: 90,
      operator: '>',
      severity: 'high',
      message: 'High disk usage detected',
    };
  }

  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.metric, rule);
  }

  public removeAlertRule(metric: string): void {
    this.alertRules.delete(metric);
  }

  public checkAlerts(point: MetricPoint): void {
    const rule = this.alertRules.get(point.metadata?.metric as string);
    if (!rule || !this.shouldTriggerAlert(point, rule)) {
      return;
    }

    this.createAlert(point, rule);
  }

  private shouldTriggerAlert(point: MetricPoint, rule: AlertRule): boolean {
    if (rule.threshold == null || rule.operator == null) return false;

    switch (rule.operator) {
      case '>':
        return point.value > rule.threshold;
      case '<':
        return point.value < rule.threshold;
      case '>=':
        return point.value >= rule.threshold;
      case '<=':
        return point.value <= rule.threshold;
      case '==':
        return point.value === rule.threshold;
      case '!=':
        return point.value !== rule.threshold;
      default:
        return false;
    }
  }

  private createAlert(point: MetricPoint, rule: AlertRule): void {
    const alert: MetricAlert = {
      id: this.generateAlertId(),
      ruleId: rule.id,
      timestamp: point.timestamp,
      severity: rule.severity,
      metric: rule.metric,
      value: point.value,
      threshold: rule.threshold,
      message: rule.message,
      tags: { ...rule.tags, ...point.tags },
    };

    this.alerts.push(alert);
    this.trimAlerts();
  }

  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private trimAlerts(): void {
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts);
    }
  }

  public getAlerts(): MetricAlert[] {
    return [...this.alerts];
  }

  public clearAlerts(): void {
    this.alerts = [];
  }

  public getActiveAlerts(): MetricAlert[] {
    const now = Date.now();
    const threshold = 5 * 60 * 1000; // 5 minutes
    return this.alerts.filter((alert) => now - alert.timestamp < threshold);
  }
}
