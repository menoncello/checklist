import type { Logger } from '../utils/logger';

/**
 * Memory snapshot for profiling
 */
export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number; // Resident Set Size
}

/**
 * CPU profiling data
 */
export interface CPUProfile {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  cpuUsage?: NodeJS.CpuUsage;
}

/**
 * Performance bottleneck identification
 */
export interface PerformanceBottleneck {
  operation: string;
  type: 'cpu' | 'memory' | 'io' | 'async';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation: string;
  metrics: {
    duration?: number;
    memoryDelta?: number;
    cpuTime?: number;
  };
}

/**
 * Profiling session configuration
 */
export interface ProfilingConfig {
  enabled: boolean;
  memorySnapshots: boolean;
  cpuProfiling: boolean;
  autoDetectBottlenecks: boolean;
  snapshotInterval: number;
  maxSnapshots: number;
  bottleneckThresholds: {
    duration: number;
    memoryGrowth: number;
    cpuUsage: number;
  };
}

/**
 * Advanced performance profiler for bottleneck identification
 */
export class PerformanceProfiler {
  private config: ProfilingConfig;
  private logger: Logger;
  private memorySnapshots: MemorySnapshot[] = [];
  private cpuProfiles: CPUProfile[] = [];
  private activeOperations: Map<
    string,
    {
      startTime: number;
      startCPU?: NodeJS.CpuUsage;
      startMemory?: MemorySnapshot;
    }
  > = new Map();
  private snapshotTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<ProfilingConfig>, logger: Logger) {
    this.config = {
      enabled: Bun.env.PERFORMANCE_PROFILING === 'true',
      memorySnapshots: Bun.env.PROFILE_MEMORY !== 'false',
      cpuProfiling: Bun.env.PROFILE_CPU !== 'false',
      autoDetectBottlenecks: Bun.env.AUTO_DETECT_BOTTLENECKS !== 'false',
      snapshotInterval: Number(Bun.env.SNAPSHOT_INTERVAL) || 1000,
      maxSnapshots: Number(Bun.env.MAX_SNAPSHOTS) || 1000,
      bottleneckThresholds: {
        duration: Number(Bun.env.BOTTLENECK_DURATION_THRESHOLD) || 100,
        memoryGrowth:
          Number(Bun.env.BOTTLENECK_MEMORY_THRESHOLD) || 10 * 1024 * 1024, // 10MB
        cpuUsage: Number(Bun.env.BOTTLENECK_CPU_THRESHOLD) || 80,
      },
      ...config,
    };

    this.logger = logger;
  }

  /**
   * Start profiling session
   */
  startProfiling(): void {
    if (!this.config.enabled) {
      this.logger.debug({ msg: 'Performance profiling disabled' });
      return;
    }

    this.logger.info({ msg: 'Starting performance profiling session' });

    // Take initial memory snapshot
    if (this.config.memorySnapshots) {
      this.takeMemorySnapshot();

      // Start periodic snapshots
      this.snapshotTimer = setInterval(() => {
        this.takeMemorySnapshot();
      }, this.config.snapshotInterval);
    }

    this.logger.debug({
      msg: 'Performance profiling session started',
      memorySnapshots: this.config.memorySnapshots,
      cpuProfiling: this.config.cpuProfiling,
      autoDetectBottlenecks: this.config.autoDetectBottlenecks,
    });
  }

  /**
   * Stop profiling session
   */
  stopProfiling(): void {
    if (!this.config.enabled) return;

    this.logger.info({ msg: 'Stopping performance profiling session' });

    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }

    // Take final snapshot
    if (this.config.memorySnapshots) {
      this.takeMemorySnapshot();
    }

    // Generate final report
    const report = this.generateProfilingReport();
    this.logger.info({
      msg: 'Profiling session completed',
      memorySnapshots: this.memorySnapshots.length,
      cpuProfiles: this.cpuProfiles.length,
      bottlenecksDetected: report.bottlenecks.length,
    });
  }

  /**
   * Start profiling a specific operation
   */
  startOperation(operation: string): void {
    if (!this.config.enabled) return;

    const startTime = performance.now();
    const startMemory = this.config.memorySnapshots
      ? this.takeMemorySnapshot()
      : undefined;
    const startCPU = this.config.cpuProfiling ? process.cpuUsage() : undefined;

    this.activeOperations.set(operation, {
      startTime,
      startMemory,
      startCPU,
    });

    this.logger.debug({
      msg: 'Started profiling operation',
      operation,
    });
  }

  /**
   * End profiling a specific operation
   */
  endOperation(operation: string): CPUProfile | null {
    if (!this.config.enabled) return null;

    const activeOp = this.activeOperations.get(operation);
    if (!activeOp) {
      this.logger.warn({
        msg: 'No active profiling session for operation',
        operation,
      });
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - activeOp.startTime;

    let cpuUsage: NodeJS.CpuUsage | undefined;
    if (this.config.cpuProfiling && activeOp.startCPU) {
      cpuUsage = process.cpuUsage(activeOp.startCPU);
    }

    const profile: CPUProfile = {
      operation,
      startTime: activeOp.startTime,
      endTime,
      duration,
      cpuUsage,
    };

    this.cpuProfiles.push(profile);
    this.activeOperations.delete(operation);

    // Check for bottlenecks
    if (this.config.autoDetectBottlenecks) {
      const bottleneck = this.detectBottleneck(profile, activeOp.startMemory);
      if (bottleneck) {
        this.logger.warn({
          msg: 'Performance bottleneck detected',
          operation: bottleneck.operation,
          type: bottleneck.type,
          severity: bottleneck.severity,
          description: bottleneck.description,
        });
      }
    }

    this.logger.debug({
      msg: 'Completed profiling operation',
      operation,
      duration,
      cpuUser: cpuUsage?.user,
      cpuSystem: cpuUsage?.system,
    });

    return profile;
  }

  /**
   * Take memory snapshot
   */
  private takeMemorySnapshot(): MemorySnapshot {
    const memUsage = process.memoryUsage();

    const snapshot: MemorySnapshot = {
      timestamp: performance.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      rss: memUsage.rss,
    };

    this.memorySnapshots.push(snapshot);

    // Limit snapshot history
    if (this.memorySnapshots.length > this.config.maxSnapshots) {
      this.memorySnapshots.shift();
    }

    return snapshot;
  }

  /**
   * Detect performance bottlenecks
   */
  private detectBottleneck(
    profile: CPUProfile,
    startMemory?: MemorySnapshot
  ): PerformanceBottleneck | null {
    const bottlenecks: PerformanceBottleneck[] = [];

    // Check duration bottleneck
    if (profile.duration > this.config.bottleneckThresholds.duration) {
      const severity = this.getDurationSeverity(profile.duration);
      bottlenecks.push({
        operation: profile.operation,
        type: 'cpu',
        severity,
        description: `Operation took ${profile.duration.toFixed(2)}ms, exceeding threshold of ${this.config.bottleneckThresholds.duration}ms`,
        recommendation: this.getDurationRecommendation(profile.duration),
        metrics: { duration: profile.duration },
      });
    }

    // Check memory growth bottleneck
    if (startMemory && this.memorySnapshots.length > 0) {
      const currentMemory =
        this.memorySnapshots[this.memorySnapshots.length - 1];
      const memoryDelta = currentMemory.heapUsed - startMemory.heapUsed;

      if (memoryDelta > this.config.bottleneckThresholds.memoryGrowth) {
        const severity = this.getMemorySeverity(memoryDelta);
        bottlenecks.push({
          operation: profile.operation,
          type: 'memory',
          severity,
          description: `Operation increased memory usage by ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`,
          recommendation: this.getMemoryRecommendation(memoryDelta),
          metrics: { memoryDelta },
        });
      }
    }

    // Check CPU usage bottleneck
    if (profile.cpuUsage) {
      const cpuTime = (profile.cpuUsage.user + profile.cpuUsage.system) / 1000; // Convert to ms
      const cpuPercent = (cpuTime / profile.duration) * 100;

      if (cpuPercent > this.config.bottleneckThresholds.cpuUsage) {
        const severity = this.getCPUSeverity(cpuPercent);
        bottlenecks.push({
          operation: profile.operation,
          type: 'cpu',
          severity,
          description: `Operation used ${cpuPercent.toFixed(1)}% CPU, exceeding threshold of ${this.config.bottleneckThresholds.cpuUsage}%`,
          recommendation: this.getCPURecommendation(cpuPercent),
          metrics: { cpuTime },
        });
      }
    }

    // Return most severe bottleneck
    return (
      bottlenecks.sort(
        (a, b) =>
          this.getSeverityWeight(b.severity) -
          this.getSeverityWeight(a.severity)
      )[0] ?? null
    );
  }

  /**
   * Determine severity based on duration
   */
  private getDurationSeverity(
    duration: number
  ): PerformanceBottleneck['severity'] {
    if (duration > 1000) return 'critical'; // > 1s
    if (duration > 500) return 'high'; // > 500ms
    if (duration > 200) return 'medium'; // > 200ms
    return 'low';
  }

  private getDurationRecommendation(duration: number): string {
    if (duration > 1000) {
      return 'Consider breaking this operation into smaller chunks or implementing caching/memoization.';
    }
    if (duration > 500) {
      return 'Profile this operation to identify expensive computations or I/O operations.';
    }
    return 'Consider optimizing algorithms or reducing computational complexity.';
  }

  /**
   * Determine severity based on memory growth
   */
  private getMemorySeverity(
    memoryDelta: number
  ): PerformanceBottleneck['severity'] {
    const mb = memoryDelta / 1024 / 1024;
    if (mb > 100) return 'critical'; // > 100MB
    if (mb > 50) return 'high'; // > 50MB
    if (mb > 20) return 'medium'; // > 20MB
    return 'low';
  }

  private getMemoryRecommendation(memoryDelta: number): string {
    const mb = memoryDelta / 1024 / 1024;
    if (mb > 100) {
      return 'URGENT: Investigate memory leaks. Consider streaming or batch processing for large datasets.';
    }
    if (mb > 50) {
      return 'Review object creation patterns and implement object pooling if appropriate.';
    }
    return 'Consider using WeakMap/WeakSet for caches or implementing garbage collection hints.';
  }

  /**
   * Determine severity based on CPU usage
   */
  private getCPUSeverity(
    cpuPercent: number
  ): PerformanceBottleneck['severity'] {
    if (cpuPercent > 95) return 'critical';
    if (cpuPercent > 90) return 'high';
    if (cpuPercent > 85) return 'medium';
    return 'low';
  }

  private getCPURecommendation(cpuPercent: number): string {
    if (cpuPercent > 95) {
      return 'URGENT: CPU-intensive operation blocking event loop. Consider Worker threads or async processing.';
    }
    if (cpuPercent > 90) {
      return 'High CPU usage detected. Profile to identify hot code paths and optimize algorithms.';
    }
    return 'Consider optimizing loops, reducing object creation, or using more efficient data structures.';
  }

  /**
   * Get numerical weight for severity comparison
   */
  private getSeverityWeight(
    severity: PerformanceBottleneck['severity']
  ): number {
    switch (severity) {
      case 'critical':
        return 4;
      case 'high':
        return 3;
      case 'medium':
        return 2;
      case 'low':
        return 1;
    }
  }

  /**
   * Analyze memory usage patterns
   */
  analyzeMemoryPattern(): {
    trend: 'stable' | 'growing' | 'shrinking' | 'volatile';
    growth: number; // bytes per second
    peakUsage: number;
    averageUsage: number;
    volatility: number; // standard deviation
  } {
    if (this.memorySnapshots.length < 2) {
      return {
        trend: 'stable',
        growth: 0,
        peakUsage: 0,
        averageUsage: 0,
        volatility: 0,
      };
    }

    const snapshots = this.memorySnapshots;
    const heapValues = snapshots.map((s) => s.heapUsed);

    // Calculate trend
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const timeDelta = (last.timestamp - first.timestamp) / 1000; // seconds
    const growth =
      timeDelta > 0 ? (last.heapUsed - first.heapUsed) / timeDelta : 0;

    // Calculate statistics
    const peakUsage = Math.max(...heapValues);
    const averageUsage =
      heapValues.reduce((sum, val) => sum + val, 0) / heapValues.length;

    // Calculate volatility (standard deviation)
    const variance =
      heapValues.reduce(
        (sum, val) => sum + Math.pow(val - averageUsage, 2),
        0
      ) / heapValues.length;
    const volatility = Math.sqrt(variance);

    // Determine trend
    let trend: 'stable' | 'growing' | 'shrinking' | 'volatile';
    const growthThreshold = 1024 * 1024; // 1MB per second
    const volatilityThreshold = averageUsage * 0.1; // 10% of average

    if (volatility > volatilityThreshold) {
      trend = 'volatile';
    } else if (growth > growthThreshold) {
      trend = 'growing';
    } else if (growth < -growthThreshold) {
      trend = 'shrinking';
    } else {
      trend = 'stable';
    }

    return { trend, growth, peakUsage, averageUsage, volatility };
  }

  /**
   * Generate comprehensive profiling report
   */
  generateProfilingReport(): {
    summary: {
      totalOperations: number;
      totalDuration: number;
      averageDuration: number;
      memorySnapshots: number;
      bottlenecksDetected: number;
    };
    memoryAnalysis: {
      trend: 'stable' | 'growing' | 'shrinking' | 'volatile';
      growth: number;
      peakUsage: number;
      averageUsage: number;
      volatility: number;
    };
    topOperations: Array<{
      operation: string;
      duration: number;
      cpuTime?: number;
    }>;
    bottlenecks: PerformanceBottleneck[];
    recommendations: string[];
  } {
    const totalDuration = this.cpuProfiles.reduce(
      (sum, p) => sum + p.duration,
      0
    );
    const averageDuration =
      this.cpuProfiles.length > 0 ? totalDuration / this.cpuProfiles.length : 0;

    // Find bottlenecks
    const bottlenecks: PerformanceBottleneck[] = [];
    for (const profile of this.cpuProfiles) {
      const bottleneck = this.detectBottleneck(profile);
      if (bottleneck) {
        bottlenecks.push(bottleneck);
      }
    }

    // Top operations by duration
    const topOperations = this.cpuProfiles
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)
      .map((p) => ({
        operation: p.operation,
        duration: p.duration,
        cpuTime: p.cpuUsage
          ? (p.cpuUsage.user + p.cpuUsage.system) / 1000
          : undefined,
      }));

    const memoryAnalysis = this.analyzeMemoryPattern();

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      bottlenecks,
      memoryAnalysis
    );

    return {
      summary: {
        totalOperations: this.cpuProfiles.length,
        totalDuration,
        averageDuration,
        memorySnapshots: this.memorySnapshots.length,
        bottlenecksDetected: bottlenecks.length,
      },
      memoryAnalysis,
      topOperations,
      bottlenecks,
      recommendations,
    };
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    bottlenecks: PerformanceBottleneck[],
    memoryAnalysis: ReturnType<typeof this.analyzeMemoryPattern>
  ): string[] {
    const recommendations: string[] = [];

    // Critical bottlenecks first
    const criticalBottlenecks = bottlenecks.filter(
      (b) => b.severity === 'critical'
    );
    if (criticalBottlenecks.length > 0) {
      recommendations.push(
        `🔴 CRITICAL: ${criticalBottlenecks.length} critical performance bottlenecks detected. Immediate action required.`
      );
    }

    // Memory recommendations
    if (memoryAnalysis.trend === 'growing') {
      recommendations.push(
        `🔍 Memory usage is growing at ${(memoryAnalysis.growth / 1024 / 1024).toFixed(2)}MB/sec. Investigate for memory leaks.`
      );
    }

    if (memoryAnalysis.trend === 'volatile') {
      recommendations.push(
        `📊 Memory usage is volatile (σ=${(memoryAnalysis.volatility / 1024 / 1024).toFixed(2)}MB). Consider object pooling.`
      );
    }

    // CPU recommendations
    const cpuBottlenecks = bottlenecks.filter((b) => b.type === 'cpu');
    if (cpuBottlenecks.length > 2) {
      recommendations.push(
        `⚡ ${cpuBottlenecks.length} CPU-intensive operations detected. Consider async processing or Worker threads.`
      );
    }

    // Duration recommendations
    const slowOperations = bottlenecks.filter(
      (b) =>
        b.metrics.duration !== null &&
        b.metrics.duration !== undefined &&
        b.metrics.duration > 500
    );
    if (slowOperations.length > 0) {
      recommendations.push(
        `🐌 ${slowOperations.length} slow operations (>500ms) detected. Profile and optimize these operations.`
      );
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push(
        '✅ No major performance issues detected. Consider periodic profiling to maintain performance.'
      );
    }

    return recommendations;
  }

  /**
   * Clear profiling data
   */
  clearData(): void {
    this.memorySnapshots.length = 0;
    this.cpuProfiles.length = 0;
    this.activeOperations.clear();
    this.logger.debug({ msg: 'Performance profiler data cleared' });
  }

  /**
   * Get current profiling statistics
   */
  getStatistics(): {
    memorySnapshots: number;
    cpuProfiles: number;
    activeOperations: number;
    currentMemoryUsage: number;
  } {
    const currentMemory =
      this.memorySnapshots.length > 0
        ? this.memorySnapshots[this.memorySnapshots.length - 1].heapUsed
        : process.memoryUsage().heapUsed;

    return {
      memorySnapshots: this.memorySnapshots.length,
      cpuProfiles: this.cpuProfiles.length,
      activeOperations: this.activeOperations.size,
      currentMemoryUsage: currentMemory,
    };
  }

  /**
   * Cleanup resources
   */
  [Symbol.dispose](): void {
    this.stopProfiling();
    this.clearData();
  }
}

/**
 * Utility function to create a performance profiler with default config
 */
export function createPerformanceProfiler(logger: Logger): PerformanceProfiler {
  const config: Partial<ProfilingConfig> = {
    enabled: Bun.env.PERFORMANCE_PROFILING === 'true',
    memorySnapshots: Bun.env.PROFILE_MEMORY !== 'false',
    cpuProfiling: Bun.env.PROFILE_CPU !== 'false',
    autoDetectBottlenecks: Bun.env.AUTO_DETECT_BOTTLENECKS !== 'false',
    snapshotInterval: Number(Bun.env.SNAPSHOT_INTERVAL) || 5000,
    maxSnapshots: Number(Bun.env.MAX_SNAPSHOTS) || 500,
  };

  return new PerformanceProfiler(config, logger);
}
