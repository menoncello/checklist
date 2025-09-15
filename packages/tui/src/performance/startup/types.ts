/**
 * Startup profiling types and interfaces
 */

export interface StartupPhase {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  description?: string;
  metadata?: Record<string, unknown>;
  subPhases?: StartupPhase[];
  parent?: string;
}

export interface StartupMilestone {
  name: string;
  timestamp: number;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface StartupProfilerConfig {
  enableProfiling: boolean;
  enableDetailedProfiling: boolean;
  trackSubPhases: boolean;
  maxPhaseDepth: number;
  enableMilestones: boolean;
  logToConsole: boolean;
  target: {
    totalStartupTime: number;
    initializationTime: number;
    renderTime: number;
  };
}

export interface StartupProfile {
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  phases: StartupPhase[];
  milestones: StartupMilestone[];
  warnings: string[];
  errors: string[];
  meetsTargets: boolean;
  targetAnalysis: TargetAnalysis;
}

export interface TargetAnalysis {
  totalStartupTime: {
    actual: number;
    target: number;
    met: boolean;
    percentage: number;
  };
  initializationTime: {
    actual: number;
    target: number;
    met: boolean;
    percentage: number;
  };
  renderTime: {
    actual: number;
    target: number;
    met: boolean;
    percentage: number;
  };
}

export interface PhaseMetrics {
  totalTime: number;
  phaseCount: number;
  averageTime: number;
  slowestPhase: StartupPhase | null;
  fastestPhase: StartupPhase | null;
}

export interface StartupAnalysis {
  totalDuration: number;
  phaseMetrics: PhaseMetrics;
  bottlenecks: StartupPhase[];
  recommendations: string[];
  targetAnalysis: TargetAnalysis;
}
