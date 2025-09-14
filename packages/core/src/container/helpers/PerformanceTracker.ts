import type { Constructor } from '../Container';

export interface PerformanceMetrics {
  serviceName: string;
  resolutionTime: number;
  memoryUsage: number;
  timestamp: Date;
}

export class PerformanceTracker {
  private performanceMetrics: Map<string, PerformanceMetrics[]> = new Map();

  async measureResolutionPerformance<T>(
    identifier: string | Constructor<T>,
    resolutionFunction: () => Promise<T>
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    const name = this.getServiceName(identifier);
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    const result = await resolutionFunction();

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;

    const metrics: PerformanceMetrics = {
      serviceName: name,
      resolutionTime: endTime - startTime,
      memoryUsage: endMemory - startMemory,
      timestamp: new Date(),
    };

    this.recordPerformanceMetrics(name, metrics);

    return { result, metrics };
  }

  getPerformanceMetrics(serviceName?: string): PerformanceMetrics[] | Map<string, PerformanceMetrics[]> {
    if (serviceName !== undefined) {
      return this.performanceMetrics.get(serviceName) ?? [];
    }
    return new Map(this.performanceMetrics);
  }

  clearPerformanceMetrics(serviceName?: string): void {
    if (serviceName !== undefined) {
      this.performanceMetrics.delete(serviceName);
    } else {
      this.performanceMetrics.clear();
    }
  }

  addPerformanceMetrics(lines: string[]): void {
    lines.push('\\nPerformance Metrics Summary:');
    for (const [service, metrics] of this.performanceMetrics) {
      if (metrics.length > 0) {
        this.addServiceMetrics(lines, service, metrics);
      }
    }
  }

  private addServiceMetrics(
    lines: string[],
    service: string,
    metrics: PerformanceMetrics[]
  ): void {
    const avgTime = metrics.reduce((sum, m) => sum + m.resolutionTime, 0) /
                    metrics.length;
    const avgMemory = metrics.reduce((sum, m) => sum + m.memoryUsage, 0) /
                      metrics.length;
    lines.push(`  - ${service}:`);
    lines.push(`    Average Resolution Time: ${avgTime.toFixed(2)}ms`);
    lines.push(`    Average Memory Usage: ${(avgMemory / 1024).toFixed(2)}KB`);
    lines.push(`    Total Resolutions: ${metrics.length}`);
  }

  private recordPerformanceMetrics(
    serviceName: string,
    metrics: PerformanceMetrics
  ): void {
    if (!this.performanceMetrics.has(serviceName)) {
      this.performanceMetrics.set(serviceName, []);
    }
    const perfMetrics = this.performanceMetrics.get(serviceName);
    if (perfMetrics !== undefined) {
      perfMetrics.push(metrics);
    }
  }

  private getServiceName(identifier: string | Constructor<unknown>): string {
    if (typeof identifier === 'string') {
      return identifier;
    }
    return identifier.name || identifier.toString();
  }
}