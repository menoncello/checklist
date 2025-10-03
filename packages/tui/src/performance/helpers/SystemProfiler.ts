export interface SystemSnapshot {
  timestamp: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  gc: {
    count: number;
    duration: number;
    type: string;
  };
  uptime: number;
  eventLoop: {
    delay: number;
  };
}

export class SystemProfiler {
  private samplingTimer: Timer | null = null;
  private baseline: SystemSnapshot | null = null;
  private gcObserver: PerformanceObserver | null = null;
  private gcStats = { count: 0, totalDuration: 0, lastType: 'unknown' };

  constructor(
    private samplingInterval: number = 1000,
    private onMetric?: (
      name: string,
      value: number,
      metadata?: Record<string, unknown>
    ) => void
  ) {}

  public start(): void {
    this.captureBaseline();
    this.startAutoSampling();
    this.setupGCObserver();
  }

  public stop(): void {
    if (this.samplingTimer != null) {
      clearInterval(this.samplingTimer);
      this.samplingTimer = null;
    }

    if (this.gcObserver != null) {
      this.gcObserver.disconnect();
      this.gcObserver = null;
    }
  }

  private captureBaseline(): void {
    this.baseline = this.getSystemSnapshot();
  }

  private startAutoSampling(): void {
    this.samplingTimer = setInterval(() => {
      this.sampleSystemMetrics();
    }, this.samplingInterval);
  }

  private setupGCObserver(): void {
    // GC observation is not available in all environments
    // Simplified implementation without PerformanceObserver
    return;
  }

  private sampleSystemMetrics(): void {
    const snapshot = this.getSystemSnapshot();

    // Record memory metrics
    this.onMetric?.('memory.heapUsed', snapshot.memory.heapUsed, {
      unit: 'bytes',
    });
    this.onMetric?.('memory.heapTotal', snapshot.memory.heapTotal, {
      unit: 'bytes',
    });
    this.onMetric?.('memory.external', snapshot.memory.external, {
      unit: 'bytes',
    });

    // Record CPU metrics (if available)
    if (snapshot.cpu.usage > 0) {
      this.onMetric?.('cpu.usage', snapshot.cpu.usage, { unit: 'percent' });
    }

    // Record event loop delay
    this.onMetric?.('eventLoop.delay', snapshot.eventLoop.delay, {
      unit: 'ms',
    });

    // Record uptime
    this.onMetric?.('process.uptime', snapshot.uptime, { unit: 'seconds' });
  }

  public getSystemSnapshot(): SystemSnapshot {
    const memoryUsage = this.getMemoryUsage();
    const cpuUsage = this.getCPUUsage();

    return {
      timestamp: Date.now(),
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external ?? 0,
        arrayBuffers: memoryUsage.arrayBuffers ?? 0,
      },
      cpu: {
        usage: cpuUsage,
        loadAverage: this.getLoadAverage(),
      },
      gc: {
        count: this.gcStats.count,
        duration: this.gcStats.totalDuration,
        type: this.gcStats.lastType,
      },
      uptime: this.getUptime(),
      eventLoop: {
        delay: this.getEventLoopDelay(),
      },
    };
  }

  private getMemoryUsage(): {
    heapUsed: number;
    heapTotal: number;
    external?: number;
    arrayBuffers?: number;
  } {
    if (typeof process !== 'undefined' && process.memoryUsage != null) {
      return process.memoryUsage();
    }

    const browserMemory = this.getBrowserMemoryUsage();
    if (browserMemory != null) {
      return browserMemory;
    }

    return { heapUsed: 0, heapTotal: 0, external: 0, arrayBuffers: 0 };
  }

  private getBrowserMemoryUsage(): {
    heapUsed: number;
    heapTotal: number;
    external?: number;
    arrayBuffers?: number;
  } | null {
    if (typeof performance === 'undefined') {
      return null;
    }

    const perfWithMemory = performance as unknown as {
      memory?: { usedJSHeapSize?: number; totalJSHeapSize?: number };
    };

    if (perfWithMemory.memory == null) {
      return null;
    }

    return {
      heapUsed: perfWithMemory.memory.usedJSHeapSize ?? 0,
      heapTotal: perfWithMemory.memory.totalJSHeapSize ?? 0,
      external: 0,
      arrayBuffers: 0,
    };
  }

  private getCPUUsage(): number {
    if (typeof process !== 'undefined' && process.cpuUsage != null) {
      const usage = process.cpuUsage();
      const total = usage.user + usage.system;
      return total / 1000 / 1000; // Convert to percentage approximation
    }
    return 0;
  }

  private getLoadAverage(): number[] {
    if (
      typeof process !== 'undefined' &&
      (process as unknown as { loadavg?: () => number[] }).loadavg != null
    ) {
      return (process as unknown as { loadavg: () => number[] }).loadavg();
    }
    return [0, 0, 0];
  }

  private getUptime(): number {
    if (typeof process !== 'undefined' && process.uptime != null) {
      return process.uptime();
    }
    return (Date.now() - (this.baseline?.timestamp ?? Date.now())) / 1000;
  }

  private getEventLoopDelay(): number {
    // This is a simplified approximation that returns 0 for synchronous context
    // In a real implementation, this would measure actual event loop delay
    return 0;
  }

  public getBaseline(): SystemSnapshot | null {
    return this.baseline;
  }

  public reset(): void {
    this.gcStats = { count: 0, totalDuration: 0, lastType: 'unknown' };
    this.captureBaseline();
  }
}
