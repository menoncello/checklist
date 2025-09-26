import { DebugMetrics } from './DebugManagerHelpers';

export class DebugMetricsCollector {
  private metrics: DebugMetrics = {
    fps: 0,
    memoryUsage: 0,
    renderTime: 0,
    componentCount: 0,
    eventCount: 0,
  };

  private frameCount = 0;
  private lastTime = performance.now();

  updateFps(): void {
    this.frameCount++;
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;

    if (deltaTime >= 1000) {
      this.metrics.fps = Math.round((this.frameCount * 1000) / deltaTime);
      this.frameCount = 0;
      this.lastTime = currentTime;
    }
  }

  updateMemory(): void {
    if (
      typeof process !== 'undefined' &&
      typeof process.memoryUsage === 'function'
    ) {
      const usage = process.memoryUsage();
      this.metrics.memoryUsage = Math.round(usage.heapUsed / 1024 / 1024);
    }
  }

  updateRenderTime(time: number): void {
    this.metrics.renderTime = time;
  }

  updateComponentCount(count: number): void {
    this.metrics.componentCount = count;
  }

  updateEventCount(count: number): void {
    this.metrics.eventCount = count;
  }

  getMetrics(): DebugMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      fps: 0,
      memoryUsage: 0,
      renderTime: 0,
      componentCount: 0,
      eventCount: 0,
    };
    this.frameCount = 0;
    this.lastTime = performance.now();
  }
}
