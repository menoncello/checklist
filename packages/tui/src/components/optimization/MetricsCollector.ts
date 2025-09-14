export interface OptimizationMetrics {
  totalItems: number;
  cachedItems: number;
  cacheHitRate: number;
  averageLoadTime: number;
  activeLoaders: number;
  memoryUsage: number;
  renderTime: number;
  scrollPerformance: {
    averageFPS: number;
    frameDrops: number;
    smoothnessScore: number;
  };
}

export class MetricsCollector {
  private loadTimes: number[] = [];
  private renderTimes: number[] = [];
  private frameTimestamps: number[] = [];
  private frameDropCount = 0;
  private activeLoadersCount = 0;

  constructor() {}

  recordLoadTime(duration: number): void {
    this.loadTimes.push(duration);
    // Keep only last 100 measurements
    if (this.loadTimes.length > 100) {
      this.loadTimes = this.loadTimes.slice(-100);
    }
  }

  recordRenderTime(duration: number): void {
    this.renderTimes.push(duration);
    if (this.renderTimes.length > 100) {
      this.renderTimes = this.renderTimes.slice(-100);
    }
  }

  recordFrame(timestamp: number): void {
    this.frameTimestamps.push(timestamp);

    // Calculate frame drops
    if (this.frameTimestamps.length > 1) {
      const timeDiff = timestamp - this.frameTimestamps[this.frameTimestamps.length - 2];
      const expectedFrameTime = 1000 / 60; // 60 FPS

      if (timeDiff > expectedFrameTime * 1.5) {
        this.frameDropCount++;
      }
    }

    // Keep only last 60 frames (1 second at 60fps)
    if (this.frameTimestamps.length > 60) {
      this.frameTimestamps = this.frameTimestamps.slice(-60);
    }
  }

  incrementActiveLoaders(): void {
    this.activeLoadersCount++;
  }

  decrementActiveLoaders(): void {
    this.activeLoadersCount = Math.max(0, this.activeLoadersCount - 1);
  }

  getMetrics(
    totalItems: number,
    cachedItems: number,
    cacheHitRate: number,
    memoryUsage: number
  ): OptimizationMetrics {
    return {
      totalItems,
      cachedItems,
      cacheHitRate,
      averageLoadTime: this.calculateAverageLoadTime(),
      activeLoaders: this.activeLoadersCount,
      memoryUsage,
      renderTime: this.calculateAverageRenderTime(),
      scrollPerformance: {
        averageFPS: this.calculateAverageFPS(),
        frameDrops: this.frameDropCount,
        smoothnessScore: this.calculateSmoothnessScore()
      }
    };
  }

  private calculateAverageLoadTime(): number {
    if (this.loadTimes.length === 0) return 0;
    return this.loadTimes.reduce((sum, time) => sum + time, 0) / this.loadTimes.length;
  }

  private calculateAverageRenderTime(): number {
    if (this.renderTimes.length === 0) return 0;
    return this.renderTimes.reduce((sum, time) => sum + time, 0) / this.renderTimes.length;
  }

  private calculateAverageFPS(): number {
    if (this.frameTimestamps.length < 2) return 0;

    const totalTime = this.frameTimestamps[this.frameTimestamps.length - 1] - this.frameTimestamps[0];
    const frameCount = this.frameTimestamps.length - 1;

    if (totalTime <= 0) return 0;

    return (frameCount * 1000) / totalTime;
  }

  private calculateSmoothnessScore(): number {
    if (this.frameTimestamps.length < 10) return 100;

    const fps = this.calculateAverageFPS();
    const targetFPS = 60;
    const fpsScore = Math.min(100, (fps / targetFPS) * 100);

    const dropRatio = this.frameDropCount / Math.max(1, this.frameTimestamps.length);
    const dropScore = Math.max(0, 100 - (dropRatio * 200)); // Heavy penalty for drops

    return (fpsScore + dropScore) / 2;
  }

  reset(): void {
    this.loadTimes = [];
    this.renderTimes = [];
    this.frameTimestamps = [];
    this.frameDropCount = 0;
    this.activeLoadersCount = 0;
  }

  getDetailedStats(): {
    loadTimes: number[];
    renderTimes: number[];
    frameDrops: number;
    activeLoaders: number;
    dataPoints: number;
  } {
    return {
      loadTimes: [...this.loadTimes],
      renderTimes: [...this.renderTimes],
      frameDrops: this.frameDropCount,
      activeLoaders: this.activeLoadersCount,
      dataPoints: Math.max(this.loadTimes.length, this.renderTimes.length)
    };
  }
}