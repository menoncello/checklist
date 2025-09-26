export class MetricsAlertManager {
  constructor() {}

  checkAlerts(value: number, threshold: number): boolean {
    return value > threshold;
  }

  addAlert(_alert: unknown): void {}

  getAlerts(): unknown[] {
    return [];
  }
}
