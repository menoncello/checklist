import type {
  PerformanceMetric,
  PerformanceBenchmark,
  PerformanceAlert,
  SystemSnapshot,
} from './PerformanceMonitor';
import type { PerformanceMonitorInternal } from './PerformanceMonitorTypes';

/**
 * Command execution monitoring for PerformanceMonitor
 */
export class PerformanceMonitorCommands {
  constructor(private monitor: PerformanceMonitorInternal) {}

  public recordCommandExecution(commandId: string, duration: number): void {
    this.monitor.recordMetricValue(
      'command_execution_time',
      duration,
      { commandId },
      { timestamp: Date.now() }
    );

    // Check if command execution exceeds performance threshold
    if (duration > 50) {
      const alert: PerformanceAlert = {
        id: `command-perf-${Date.now()}`,
        metric: 'command_execution_time',
        value: duration,
        threshold: 50,
        level: 'warning',
        message: `Command '${commandId}' execution time ${duration.toFixed(
          2
        )}ms exceeds 50ms threshold`,
        timestamp: Date.now(),
      };

      this.monitor.recordAlert(alert);
      this.monitor.emit('alert', alert);
    }
  }

  public generateReport(): {
    metrics: PerformanceMetric[];
    benchmarks: PerformanceBenchmark[];
    alerts: PerformanceAlert[];
    systemSnapshot: SystemSnapshot;
  } {
    return {
      metrics: this.monitor.getMetrics(),
      benchmarks: this.monitor.getBenchmarks(),
      alerts: this.monitor.getAlerts(),
      systemSnapshot: this.monitor.getSystemSnapshot(),
    };
  }
}
