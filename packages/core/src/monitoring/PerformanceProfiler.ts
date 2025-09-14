import type { Logger } from '../utils/logger';
import { BottleneckDetector } from './performance/BottleneckDetector.js';
import { MemoryAnalyzer } from './performance/MemoryAnalyzer.js';
import { ReportGenerator } from './performance/ReportGenerator.js';
import type {
  MemorySnapshot,
  CPUProfile,
  ProfilingConfig,
  ActiveOperation,
  ProfilingReport,
} from './performance/types.js';

// Re-export types for backward compatibility
export type {
  MemorySnapshot,
  CPUProfile,
  ProfilingConfig,
  PerformanceBottleneck,
} from './performance/types.js';

/**
 * Advanced performance profiler for bottleneck identification
 */
export class PerformanceProfiler {
  private config: ProfilingConfig;
  private logger: Logger;
  private memorySnapshots: MemorySnapshot[] = [];
  private cpuProfiles: CPUProfile[] = [];
  private activeOperations: Map<string, ActiveOperation> = new Map();
  private snapshotTimer: NodeJS.Timeout | null = null;
  private bottleneckDetector: BottleneckDetector;
  private memoryAnalyzer: MemoryAnalyzer;
  private reportGenerator: ReportGenerator;

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

    // Initialize helper classes
    this.bottleneckDetector = new BottleneckDetector(this.config);
    this.memoryAnalyzer = new MemoryAnalyzer();
    this.reportGenerator = new ReportGenerator(this.bottleneckDetector);
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
      this.logWarningForMissingOperation(operation);
      return null;
    }

    const profile = this.createProfileFromOperation(operation, activeOp);
    this.cpuProfiles.push(profile);
    this.activeOperations.delete(operation);

    this.checkForBottlenecks(profile, activeOp.startMemory);
    this.logOperationCompletion(operation, profile);

    return profile;
  }

  private logWarningForMissingOperation(operation: string): void {
    this.logger.warn({
      msg: 'No active profiling session for operation',
      operation,
    });
  }

  private createProfileFromOperation(operation: string, activeOp: ActiveOperation): CPUProfile {
    const endTime = performance.now();
    const duration = endTime - activeOp.startTime;

    let cpuUsage: NodeJS.CpuUsage | undefined;
    if (this.config.cpuProfiling && activeOp.startCPU) {
      cpuUsage = process.cpuUsage(activeOp.startCPU);
    }

    return {
      operation,
      startTime: activeOp.startTime,
      endTime,
      duration,
      cpuUsage,
    };
  }

  private checkForBottlenecks(profile: CPUProfile, startMemory?: MemorySnapshot): void {
    if (!this.config.autoDetectBottlenecks) return;

    const bottleneck = this.bottleneckDetector.detectBottleneck(
      profile,
      startMemory,
      this.memorySnapshots
    );

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

  private logOperationCompletion(operation: string, profile: CPUProfile): void {
    this.logger.debug({
      msg: 'Completed profiling operation',
      operation,
      duration: profile.duration,
      cpuUser: profile.cpuUsage?.user,
      cpuSystem: profile.cpuUsage?.system,
    });
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
   * Analyze memory usage patterns
   */
  analyzeMemoryPattern(): {
    trend: 'stable' | 'growing' | 'shrinking' | 'volatile';
    growth: number; // bytes per second
    peakUsage: number;
    averageUsage: number;
    volatility: number; // standard deviation
  } {
    return this.memoryAnalyzer.analyzeMemoryPattern(this.memorySnapshots);
  }

  /**
   * Generate comprehensive profiling report
   */
  generateProfilingReport(): ProfilingReport {
    const memoryAnalysis = this.analyzeMemoryPattern();
    return this.reportGenerator.generateProfilingReport(
      this.cpuProfiles,
      memoryAnalysis,
      this.memorySnapshots.length
    );
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
