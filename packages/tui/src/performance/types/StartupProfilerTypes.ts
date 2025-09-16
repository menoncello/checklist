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

export interface PhaseOptions {
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface PhaseStatistics {
  longestPhase: StartupPhase | null;
  shortestPhase: StartupPhase | null;
  averageDuration: number;
  totalPhases: number;
  averagePhaseTime: number;
  totalPhaseTime: number;
}

export interface BottleneckInfo {
  phase: StartupPhase;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
  impact: 'low' | 'medium' | 'high';
  percentage: number;
}

export interface StartupReport {
  profile: StartupProfile;
  statistics: PhaseStatistics;
  bottlenecks: BottleneckInfo[];
  performanceScore: number;
  recommendations: string[];
  performance: {
    startup: string;
  };
}
