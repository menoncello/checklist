import type { PerformanceMetrics } from './types';

export class PerformanceMeasurement {
  private startTime: number = 0;
  private frameCount: number = 0;
  private memoryBefore: number = 0;

  start(): void {
    this.memoryBefore = process.memoryUsage().heapUsed;
    this.startTime = performance.now();
    this.frameCount = 0;
  }

  recordFrame(): void {
    this.frameCount++;
  }

  end(): PerformanceMetrics {
    const endTime = performance.now();
    const memoryAfter = process.memoryUsage().heapUsed;
    
    return {
      startTime: this.startTime,
      endTime,
      memoryBefore: this.memoryBefore,
      memoryAfter,
      frameCount: this.frameCount
    };
  }

  calculateMetrics(metrics: PerformanceMetrics) {
    const duration = metrics.endTime - metrics.startTime;
    const memoryUsed = (metrics.memoryAfter - metrics.memoryBefore) / 1024 / 1024; // MB
    const fps = metrics.frameCount > 0 ? (metrics.frameCount / duration) * 1000 : 0;
    
    return {
      startupTime: duration,
      renderTime: duration / Math.max(1, metrics.frameCount),
      memoryUsed: Math.max(0, memoryUsed),
      fps
    };
  }
}

export async function measurePerformance<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number; memory: number }> {
  const memBefore = process.memoryUsage().heapUsed;
  const start = performance.now();
  
  const result = await fn();
  
  const duration = performance.now() - start;
  const memory = (process.memoryUsage().heapUsed - memBefore) / 1024 / 1024;
  
  return { result, duration, memory: Math.max(0, memory) };
}