export interface PerformanceReport {
  timestamp: number;
  uptime: number;
  system: {
    memory: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
      external: number;
      arrayBuffers: number;
    };
    cpu: {
      user: number;
      system: number;
    };
    eventLoopDelay: number;
  };
  startup: unknown;
  memory: {
    current: unknown;
    trends: unknown[];
    leaks: unknown[];
  };
  metrics: {
    totalSeries: number;
    totalPoints: number;
    sampleRate: number;
  };
  alerts: {
    performance: unknown[];
    memory: unknown[];
    metrics: unknown[];
  };
  recommendations: string[];
}

export class ReportBuilder {
  createSystemReport(monitorSnapshot: unknown): {
    memory: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
      external: number;
      arrayBuffers: number;
    };
    cpu: {
      user: number;
      system: number;
    };
    eventLoopDelay: number;
  } {
    const snapshot = monitorSnapshot as {
      memory?: NodeJS.MemoryUsage;
      cpu?: { user: number; system: number };
    };

    return {
      memory: this.extractMemoryData(snapshot.memory),
      cpu: this.extractCpuData(snapshot.cpu),
      eventLoopDelay: 0,
    };
  }

  private extractMemoryData(memory?: NodeJS.MemoryUsage) {
    if (!memory) {
      return {
        rss: 0,
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        arrayBuffers: 0,
      };
    }
    return {
      rss: memory.rss ?? 0,
      heapUsed: memory.heapUsed ?? 0,
      heapTotal: memory.heapTotal ?? 0,
      external: memory.external ?? 0,
      arrayBuffers: memory.arrayBuffers ?? 0,
    };
  }

  private extractCpuData(cpu?: { user: number; system: number }) {
    if (!cpu) {
      return { user: 0, system: 0 };
    }
    return {
      user: cpu.user ?? 0,
      system: cpu.system ?? 0,
    };
  }

  createMemoryReport(memoryStats: unknown, leaks: unknown[]) {
    const stats = memoryStats as {
      current?: NodeJS.MemoryUsage;
      trends?: unknown[];
    };

    return {
      current: this.extractCurrentMemory(stats.current),
      trends: stats.trends ?? [],
      leaks,
    };
  }

  private extractCurrentMemory(current?: NodeJS.MemoryUsage) {
    if (!current) {
      return {
        rss: 0,
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        arrayBuffers: 0,
      };
    }
    return {
      rss: current.rss ?? 0,
      heapUsed: current.heapUsed ?? 0,
      heapTotal: current.heapTotal ?? 0,
      external: current.external ?? 0,
      arrayBuffers: current.arrayBuffers ?? 0,
    };
  }

  buildAlerts(data: { leaks: unknown[]; monitor: unknown; metrics: unknown }) {
    return {
      performance: this.extractPerformanceAlerts(data.monitor),
      memory: this.extractMemoryAlerts(data.leaks),
      metrics: this.extractMetricsAlerts(data.metrics),
    };
  }

  private extractPerformanceAlerts(monitor: unknown): unknown[] {
    const m = monitor as { getAlerts?: () => unknown[] };
    return m.getAlerts?.() ?? [];
  }

  private extractMemoryAlerts(leaks: unknown[]): unknown[] {
    return (leaks as Array<{ type: string; timestamp: number }>).map(
      (leak) => ({
        type: 'memory_leak' as const,
        severity: 'critical' as const,
        message: `Memory leak detected: ${leak.type}`,
        timestamp: leak.timestamp,
        data: leak,
      })
    );
  }

  private extractMetricsAlerts(metrics: unknown): unknown[] {
    const m = metrics as { getAlerts?: () => unknown[] };
    return m.getAlerts?.() ?? [];
  }

  generateRecommendations(
    metricsReport: { recommendations?: string[] },
    memoryTracker: unknown,
    startupProfiler: unknown,
    monitor: unknown
  ): string[] {
    const recs: string[] = [];

    if (metricsReport.recommendations) {
      recs.push(...metricsReport.recommendations);
    }

    this.addMemoryRecommendations(recs, memoryTracker);
    this.addStartupRecommendations(recs, startupProfiler);
    this.addSystemRecommendations(recs, monitor);

    return recs;
  }

  private addMemoryRecommendations(
    recs: string[],
    memoryTracker: unknown
  ): void {
    const tracker = memoryTracker as {
      getStatistics: () => {
        trends: Array<{ direction: string; rate: number }>;
      };
    };
    const trends = tracker.getStatistics().trends;

    if (
      trends.some((t) => t.direction === 'increasing' && t.rate > 1024 * 1024)
    ) {
      recs.push(
        'Memory usage is increasing rapidly. Consider profiling for leaks.'
      );
    }
  }

  private addStartupRecommendations(
    recs: string[],
    startupProfiler: unknown
  ): void {
    const profiler = startupProfiler as {
      isCompleted: () => boolean;
      generateReport: () => { recommendations?: string[] };
    };

    if (profiler.isCompleted()) {
      const r = profiler.generateReport();
      if (r.recommendations) {
        recs.push(...r.recommendations);
      }
    }
  }

  private addSystemRecommendations(recs: string[], monitor: unknown): void {
    const m = monitor as {
      getSystemSnapshot: () => { memory?: NodeJS.MemoryUsage };
    };
    const sys = m.getSystemSnapshot();

    if (sys.memory) {
      const usage = sys.memory.heapUsed / sys.memory.heapTotal;
      if (usage > 0.9) {
        recs.push(
          'Heap usage is over 90%. Consider increasing heap size or optimizing memory usage.'
        );
      }
    }
  }
}
