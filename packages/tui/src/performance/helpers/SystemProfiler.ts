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
    private onMetric?: (name: string, value: number, metadata?: Record<string, unknown>) => void
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
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      this.gcObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'gc') {
            this.gcStats.count++;
            this.gcStats.totalDuration += entry.duration;
            this.gcStats.lastType = (entry as any).detail?.type || 'unknown';

            this.onMetric?.('gc.count', this.gcStats.count);
            this.onMetric?.('gc.duration', entry.duration);
            this.onMetric?.('gc.totalDuration', this.gcStats.totalDuration);
          }
        }
      });

      this.gcObserver.observe({ entryTypes: ['gc'] });
    } catch (error) {
      // GC observation might not be available in all environments
    }
  }

  private sampleSystemMetrics(): void {
    const snapshot = this.getSystemSnapshot();

    // Record memory metrics
    this.onMetric?.('memory.heapUsed', snapshot.memory.heapUsed, { unit: 'bytes' });
    this.onMetric?.('memory.heapTotal', snapshot.memory.heapTotal, { unit: 'bytes' });
    this.onMetric?.('memory.external', snapshot.memory.external, { unit: 'bytes' });

    // Record CPU metrics (if available)
    if (snapshot.cpu.usage > 0) {
      this.onMetric?.('cpu.usage', snapshot.cpu.usage, { unit: 'percent' });
    }

    // Record event loop delay
    this.onMetric?.('eventLoop.delay', snapshot.eventLoop.delay, { unit: 'ms' });

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
        external: memoryUsage.external || 0,
        arrayBuffers: memoryUsage.arrayBuffers || 0
      },
      cpu: {
        usage: cpuUsage,
        loadAverage: this.getLoadAverage()
      },
      gc: {
        count: this.gcStats.count,
        duration: this.gcStats.totalDuration,
        type: this.gcStats.lastType
      },
      uptime: this.getUptime(),
      eventLoop: {
        delay: this.getEventLoopDelay()
      }
    };
  }

  private getMemoryUsage(): {
    heapUsed: number;
    heapTotal: number;
    external?: number;
    arrayBuffers?: number;
  } {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    }

    // Fallback for browser environments
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      return {
        heapUsed: memory.usedJSHeapSize || 0,
        heapTotal: memory.totalJSHeapSize || 0,
        external: 0,
        arrayBuffers: 0
      };
    }

    return { heapUsed: 0, heapTotal: 0, external: 0, arrayBuffers: 0 };
  }

  private getCPUUsage(): number {
    if (typeof process !== 'undefined' && process.cpuUsage) {
      const usage = process.cpuUsage();
      const total = usage.user + usage.system;
      return (total / 1000) / 1000; // Convert to percentage approximation
    }
    return 0;
  }

  private getLoadAverage(): number[] {
    if (typeof process !== 'undefined' && process.loadavg) {
      return process.loadavg();
    }
    return [0, 0, 0];
  }

  private getUptime(): number {
    if (typeof process !== 'undefined' && process.uptime) {
      return process.uptime();
    }
    return (Date.now() - (this.baseline?.timestamp || Date.now())) / 1000;
  }

  private getEventLoopDelay(): number {
    // This is a simplified approximation
    const start = performance.now();
    return new Promise(resolve => {
      setImmediate(() => {
        const delay = performance.now() - start;
        resolve(delay);
      });
    }) as any; // Return 0 for synchronous context
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