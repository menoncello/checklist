export class PerformanceMonitorClearOperations {
  constructor(private core: Record<string, Function>) {}

  public clearAll(): void {
    this.core.clearMetrics();
    this.core.clearBenchmarks();
    this.core.clearAlerts();
  }

  public clearMetrics(): void {
    this.core.clearMetrics();
  }

  public clearBenchmarks(): void {
    this.core.clearBenchmarks();
  }

  public clearAlerts(): void {
    this.core.clearAlerts();
  }
}
