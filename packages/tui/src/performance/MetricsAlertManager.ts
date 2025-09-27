import type {
  AlertRule,
  MetricAlert,
  MetricPoint,
  MetricsCollectorConfig,
} from './MetricsTypes';

export class MetricsAlertManager {
  private config: MetricsCollectorConfig;
  private emit: (event: string, data?: unknown) => void;
  private alerts: MetricAlert[] = [];
  private rules: AlertRule[] = [];

  constructor(
    config: MetricsCollectorConfig,
    emit: (event: string, data?: unknown) => void
  ) {
    this.config = config;
    this.emit = emit;
  }

  checkAlerts(name: string, point: MetricPoint): void {
    const rule = this.rules.find((r) => r.metricName === name && r.enabled);
    if (rule) {
      const shouldAlert = this.evaluateRule(rule, point.value);
      if (shouldAlert) {
        const alert: MetricAlert = {
          id: `alert-${Date.now()}`,
          ruleId: rule.id,
          metricName: name,
          value: point.value,
          threshold: rule.threshold,
          timestamp: Date.now(),
          resolved: false,
        };
        this.alerts.push(alert);
        this.emit('alert', alert);
      }
    }
  }

  private evaluateRule(rule: AlertRule, value: number): boolean {
    switch (rule.condition) {
      case 'greater_than':
        return value > rule.threshold;
      case 'less_than':
        return value < rule.threshold;
      case 'equals':
        return value === rule.threshold;
      default:
        return false;
    }
  }

  addAlertRule(rule: AlertRule): void {
    this.rules.push(rule);
  }

  removeAlertRule(id: string): boolean {
    const index = this.rules.findIndex((r) => r.id === id);
    if (index >= 0) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  getAlerts(): MetricAlert[] {
    return [...this.alerts];
  }

  clearAlerts(): void {
    this.alerts = [];
  }

  cleanupOldAlerts(cutoff: number): void {
    this.alerts = this.alerts.filter((alert) => alert.timestamp > cutoff);
  }
}
