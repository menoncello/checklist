/**
 * Performance monitoring types and interfaces
 */

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
 * Memory analysis result
 */
export interface MemoryAnalysis {
  trend: 'stable' | 'growing' | 'shrinking' | 'volatile';
  growth: number; // bytes per second
  peakUsage: number;
  averageUsage: number;
  volatility: number; // standard deviation
}

/**
 * Profiling report summary
 */
export interface ProfilingSummary {
  totalOperations: number;
  totalDuration: number;
  averageDuration: number;
  memorySnapshots: number;
  bottlenecksDetected: number;
}

/**
 * Top operation data
 */
export interface TopOperation {
  operation: string;
  duration: number;
  cpuTime?: number;
}

/**
 * Complete profiling report
 */
export interface ProfilingReport {
  summary: ProfilingSummary;
  memoryAnalysis: MemoryAnalysis;
  topOperations: TopOperation[];
  bottlenecks: PerformanceBottleneck[];
  recommendations: string[];
}

/**
 * Active operation tracking data
 */
export interface ActiveOperation {
  startTime: number;
  startCPU?: NodeJS.CpuUsage;
  startMemory?: MemorySnapshot;
}
