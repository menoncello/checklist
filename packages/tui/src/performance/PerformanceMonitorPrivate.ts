import { PerformanceMonitorSystemMetrics } from './PerformanceMonitorSystemMetrics';
import type { PerformanceMonitorComponents } from './helpers/PerformanceMonitorFactory';

export class PerformanceMonitorPrivate {
  constructor(
    private systemMetrics: PerformanceMonitorSystemMetrics,
    private components: PerformanceMonitorComponents
  ) {}

  public handleSystemMetric(
    name: string,
    value: number,
    metadata?: Record<string, unknown>
  ): void {
    this.systemMetrics.handleSystemMetric(name, value, metadata);
  }

  public initializeComponents(
    _config: unknown,
    _systemMetricHandler: (
      name: string,
      value: number,
      metadata?: Record<string, unknown>
    ) => void
  ): PerformanceMonitorComponents {
    return this.components;
  }
}
