import type { PerformanceMonitorInternal } from './PerformanceMonitorTypes';

/**
 * Lifecycle management methods for PerformanceMonitor
 */
export class PerformanceMonitorLifecycle {
  constructor(private monitor: PerformanceMonitorInternal) {}

  // Circuit breaker
  public isCircuitBreakerActive(): boolean {
    return this.monitor.circuitBreaker.isActive();
  }

  public resetCircuitBreaker(): void {
    this.monitor.circuitBreaker.reset();
  }

  // Cleanup
  public clearAll(): void {
    this.monitor.core.clearAll();
  }

  public clearMetrics(): void {
    this.monitor.core.clearMetrics();
  }

  public clearBenchmarks(): void {
    this.monitor.core.clearBenchmarks();
  }

  public clearAlerts(): void {
    this.monitor.core.clearAlerts();
  }

  public destroy(): void {
    this.clearAll();
    this.monitor.operations.destroy();
    this.monitor.eventManagerWrapper.clear();
    this.monitor.eventManagerWrapper.emit('destroyed');
  }
}
