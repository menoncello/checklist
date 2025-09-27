import { PerformanceMetric } from './MetricsTracker';

export class PerformanceThreshold {
  metric!: string;
  warningValue!: number;
  criticalValue!: number;
  direction!: 'above' | 'below';
}

export class PerformanceAlert {
  id!: string;
  timestamp!: number;
  metric!: string;
  value!: number;
  threshold!: PerformanceThreshold | number;
  level!: 'warning' | 'critical';
  message!: string;
}

export class AlertManager {
  private thresholds = new Map<string, PerformanceThreshold>();
  private alerts: PerformanceAlert[] = [];

  constructor(private bufferSize: number = 1000) {
    this.setupDefaultThresholds();
  }

  private setupDefaultThresholds(): void {
    const defaults = this.createDefaultThresholds();
    defaults.forEach((threshold) => {
      this.thresholds.set(threshold.metric, threshold);
    });
  }

  private createDefaultThresholds(): PerformanceThreshold[] {
    return [
      {
        metric: 'memory.heapUsed',
        warningValue: 100 * 1024 * 1024, // 100MB
        criticalValue: 500 * 1024 * 1024, // 500MB
        direction: 'above',
      },
      {
        metric: 'cpu.usage',
        warningValue: 70,
        criticalValue: 90,
        direction: 'above',
      },
      {
        metric: 'render.frameTime',
        warningValue: 16.67, // 60fps
        criticalValue: 33.33, // 30fps
        direction: 'above',
      },
      {
        metric: 'gc.duration',
        warningValue: 10,
        criticalValue: 50,
        direction: 'above',
      },
    ];
  }

  public addThreshold(threshold: PerformanceThreshold): void {
    this.thresholds.set(threshold.metric, threshold);
  }

  public removeThreshold(metric: string): boolean {
    return this.thresholds.delete(metric);
  }

  public checkMetric(metric: PerformanceMetric): PerformanceAlert | null {
    const threshold = this.thresholds.get(metric.name);
    if (threshold == null) {
      return null;
    }

    let level: 'warning' | 'critical' | null = null;

    if (threshold.direction === 'above') {
      if (metric.value >= threshold.criticalValue) {
        level = 'critical';
      } else if (metric.value >= threshold.warningValue) {
        level = 'warning';
      }
    } else {
      if (metric.value <= threshold.criticalValue) {
        level = 'critical';
      } else if (metric.value <= threshold.warningValue) {
        level = 'warning';
      }
    }

    if (level != null) {
      const alert = this.createAlert(metric, threshold, level);
      this.alerts.push(alert);

      if (this.alerts.length > this.bufferSize) {
        this.alerts = this.alerts.slice(-this.bufferSize);
      }

      return alert;
    }

    return null;
  }

  private createAlert(
    metric: PerformanceMetric,
    threshold: PerformanceThreshold,
    level: 'warning' | 'critical'
  ): PerformanceAlert {
    const direction = threshold.direction === 'above' ? 'above' : 'below';
    const thresholdValue =
      level === 'critical' ? threshold.criticalValue : threshold.warningValue;

    return {
      id: `alert-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      metric: metric.name,
      value: metric.value,
      threshold,
      level,
      message: `Metric '${metric.name}' is ${direction} ${level} threshold: ${metric.value} ${direction} ${thresholdValue}`,
    };
  }

  public getAlerts(level?: 'warning' | 'critical'): PerformanceAlert[] {
    if (level != null) {
      return this.alerts.filter((alert) => alert.level === level);
    }
    return [...this.alerts];
  }

  public getThresholds(): PerformanceThreshold[] {
    return Array.from(this.thresholds.values());
  }

  public getThreshold(metric: string): PerformanceThreshold | null {
    return this.thresholds.get(metric) ?? null;
  }

  public recordAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);

    if (this.alerts.length > this.bufferSize) {
      this.alerts = this.alerts.slice(-this.bufferSize);
    }
  }

  public clear(): void {
    this.alerts = [];
  }

  public clearThresholds(): void {
    this.thresholds.clear();
    this.setupDefaultThresholds();
  }

  public count(): number {
    return this.alerts.length;
  }
}
