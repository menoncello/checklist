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

export class StartupProfiler {
  private config: StartupProfilerConfig;
  private startTime: number;
  private phases = new Map<string, StartupPhase>();
  private phaseStack: string[] = [];
  private milestones: StartupMilestone[] = [];
  private warnings: string[] = [];
  private errors: string[] = [];
  private eventHandlers = new Map<string, Set<Function>>();
  private completed = false;

  constructor(config: Partial<StartupProfilerConfig> = {}) {
    this.config = {
      enableProfiling: true,
      enableDetailedProfiling: false,
      trackSubPhases: true,
      maxPhaseDepth: 5,
      enableMilestones: true,
      logToConsole: false,
      target: {
        totalStartupTime: 100, // 100ms
        initializationTime: 50, // 50ms
        renderTime: 50, // 50ms
      },
      ...config,
    };

    this.startTime = performance.now();
    this.log('Startup profiling initiated');

    if (this.config.enableProfiling) {
      this.setupDefaultPhases();
    }
  }

  private setupDefaultPhases(): void {
    // Framework initialization phase
    this.startPhase('framework_init', {
      description: 'Framework initialization and setup',
      metadata: { category: 'initialization' },
    });
  }

  public startPhase(name: string, options: PhaseOptions = {}): void {
    if (!this.config.enableProfiling || this.completed) return;

    // Check depth limit
    if (this.phaseStack.length >= this.config.maxPhaseDepth) {
      this.addWarning(
        `Maximum phase depth (${this.config.maxPhaseDepth}) exceeded for phase: ${name}`
      );
      return;
    }

    const phase: StartupPhase = {
      name,
      startTime: performance.now(),
      description: options.description,
      metadata: options.metadata,
      subPhases: this.config.trackSubPhases ? [] : undefined,
      parent:
        this.phaseStack.length > 0
          ? this.phaseStack[this.phaseStack.length - 1]
          : undefined,
    };

    this.phases.set(name, phase);
    this.phaseStack.push(name);

    // Add as subphase to parent if tracking subphases
    if (
      this.config.trackSubPhases &&
      phase.parent != null &&
      phase.parent.length > 0
    ) {
      const parent = this.phases.get(phase.parent);
      if (parent?.subPhases) {
        parent.subPhases.push(phase);
      }
    }

    this.log(`Started phase: ${name}`);
    this.emit('phaseStarted', { phase });
  }

  public endPhase(name: string): StartupPhase | null {
    if (this.config.enableProfiling !== true || this.completed) return null;

    const phase = this.phases.get(name);
    if (!phase) {
      this.addError(`Attempted to end non-existent phase: ${name}`);
      return null;
    }

    if (phase.endTime != null && phase.endTime !== 0) {
      this.addWarning(`Phase already ended: ${name}`);
      return phase;
    }

    phase.endTime = performance.now();
    phase.duration = phase.endTime - phase.startTime;

    // Remove from stack
    const stackIndex = this.phaseStack.indexOf(name);
    if (stackIndex !== -1) {
      this.phaseStack.splice(stackIndex, 1);
    }

    this.log(`Ended phase: ${name} (${phase.duration.toFixed(2)}ms)`);
    this.emit('phaseEnded', { phase });

    return phase;
  }

  public addMilestone(
    name: string,
    description?: string,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.config.enableMilestones || this.completed) return;

    const milestone: StartupMilestone = {
      name,
      timestamp: performance.now(),
      description,
      metadata,
    };

    this.milestones.push(milestone);
    this.log(`Milestone reached: ${name}`);
    this.emit('milestone', { milestone });
  }

  public measureFunction<T extends (...args: unknown[]) => unknown>(
    fn: T,
    phaseName: string,
    description?: string
  ): T {
    return ((...args: unknown[]) => {
      this.startPhase(phaseName, { description });

      try {
        const result = fn(...args);

        if (result instanceof Promise) {
          return result.finally(() => {
            this.endPhase(phaseName);
          });
        } else {
          this.endPhase(phaseName);
          return result;
        }
      } catch (error) {
        this.endPhase(phaseName);
        this.addError(
          `Error in phase ${phaseName}: ${(error as Error).message}`
        );
        throw error;
      }
    }) as T;
  }

  public measureAsync<T>(
    promise: Promise<T>,
    phaseName: string,
    description?: string
  ): Promise<T> {
    this.startPhase(phaseName, { description });

    return promise
      .then((result) => {
        this.endPhase(phaseName);
        return result;
      })
      .catch((error) => {
        this.endPhase(phaseName);
        this.addError(`Error in async phase ${phaseName}: ${error.message}`);
        throw error;
      });
  }

  public completeStartup(): StartupProfile {
    if (this.completed) {
      return this.generateProfile();
    }

    const endTime = performance.now();
    this.completed = true;

    // End any remaining phases
    const remainingPhases = [...this.phaseStack];
    for (const phaseName of remainingPhases) {
      this.endPhase(phaseName);
    }

    const totalDuration = endTime - this.startTime;

    this.log(`Startup completed in ${totalDuration.toFixed(2)}ms`);
    this.addMilestone('startup_complete', 'Application startup completed');

    const profile = this.generateProfile();
    this.emit('startupComplete', { profile });

    return profile;
  }

  private generateProfile(): StartupProfile {
    const endTime = this.completed ? performance.now() : undefined;
    const totalDuration =
      endTime != null && endTime !== 0 ? endTime - this.startTime : undefined;

    // Get root phases (phases without parents)
    const rootPhases = Array.from(this.phases.values()).filter(
      (phase) => phase.parent == null || phase.parent.length === 0
    );

    const profile: StartupProfile = {
      startTime: this.startTime,
      endTime,
      totalDuration,
      phases: rootPhases,
      milestones: [...this.milestones],
      warnings: [...this.warnings],
      errors: [...this.errors],
      meetsTargets: false,
      targetAnalysis: this.analyzeTargets(),
    };

    profile.meetsTargets = this.checkTargetsMet(profile.targetAnalysis);

    return profile;
  }

  private analyzeTargets(): TargetAnalysis {
    const initPhase = this.phases.get('framework_init');
    const renderPhase = this.phases.get('initial_render');

    const totalActual = this.completed ? performance.now() - this.startTime : 0;
    const initActual = initPhase?.duration ?? 0;
    const renderActual = renderPhase?.duration ?? 0;

    return {
      totalStartupTime: {
        actual: totalActual,
        target: this.config.target.totalStartupTime,
        met: totalActual <= this.config.target.totalStartupTime,
        percentage: (totalActual / this.config.target.totalStartupTime) * 100,
      },
      initializationTime: {
        actual: initActual,
        target: this.config.target.initializationTime,
        met: initActual <= this.config.target.initializationTime,
        percentage: (initActual / this.config.target.initializationTime) * 100,
      },
      renderTime: {
        actual: renderActual,
        target: this.config.target.renderTime,
        met: renderActual <= this.config.target.renderTime,
        percentage: (renderActual / this.config.target.renderTime) * 100,
      },
    };
  }

  private checkTargetsMet(analysis: TargetAnalysis): boolean {
    return (
      analysis.totalStartupTime.met &&
      analysis.initializationTime.met &&
      analysis.renderTime.met
    );
  }

  public getPhase(name: string): StartupPhase | null {
    return this.phases.get(name) ?? null;
  }

  public getAllPhases(): StartupPhase[] {
    return Array.from(this.phases.values());
  }

  public getMilestones(): StartupMilestone[] {
    return [...this.milestones];
  }

  public getWarnings(): string[] {
    return [...this.warnings];
  }

  public getErrors(): string[] {
    return [...this.errors];
  }

  public getCurrentPhase(): string | null {
    return this.phaseStack.length > 0
      ? this.phaseStack[this.phaseStack.length - 1]
      : null;
  }

  public getActivePhases(): string[] {
    return [...this.phaseStack];
  }

  public isCompleted(): boolean {
    return this.completed;
  }

  public getUptime(): number {
    return performance.now() - this.startTime;
  }

  private addWarning(message: string): void {
    this.warnings.push(message);
    this.log(`Warning: ${message}`);
  }

  private addError(message: string): void {
    this.errors.push(message);
    this.log(`Error: ${message}`);
  }

  public generateReport(): StartupReport {
    const profile = this.generateProfile();

    // Calculate phase statistics
    const phaseStats = this.calculatePhaseStatistics(profile.phases);

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(profile.phases);

    // Generate recommendations
    const recommendations = this.generateRecommendations(profile);

    return {
      profile,
      statistics: {
        totalPhases: this.phases.size,
        totalMilestones: this.milestones.length,
        longestPhase: phaseStats.longest,
        shortestPhase: phaseStats.shortest,
        averagePhaseTime: phaseStats.average,
        totalPhaseTime: phaseStats.total,
      },
      bottlenecks,
      recommendations,
      performance: {
        startup:
          profile.totalDuration != null && profile.totalDuration !== 0
            ? this.categorizePerformance(
                profile.totalDuration,
                this.config.target.totalStartupTime
              )
            : 'unknown',
        initialization: profile.targetAnalysis.initializationTime.actual
          ? this.categorizePerformance(
              profile.targetAnalysis.initializationTime.actual,
              this.config.target.initializationTime
            )
          : 'unknown',
        rendering: profile.targetAnalysis.renderTime.actual
          ? this.categorizePerformance(
              profile.targetAnalysis.renderTime.actual,
              this.config.target.renderTime
            )
          : 'unknown',
      },
    };
  }

  private calculatePhaseStatistics(phases: StartupPhase[]): PhaseStatistics {
    const durations = phases
      .filter((phase) => phase.duration !== undefined)
      .map((phase) => phase.duration)
      .filter((d): d is number => d != null);

    if (durations.length === 0) {
      return {
        longest: null,
        shortest: null,
        average: 0,
        total: 0,
      };
    }

    const total = durations.reduce((sum, duration) => sum + duration, 0);
    const sortedDurations = [...durations].sort((a, b) => b - a);

    return {
      longest: phases.find((p) => p.duration === sortedDurations[0]) ?? null,
      shortest:
        phases.find(
          (p) => p.duration === sortedDurations[sortedDurations.length - 1]
        ) ?? null,
      average: total / durations.length,
      total,
    };
  }

  private identifyBottlenecks(phases: StartupPhase[]): BottleneckInfo[] {
    const bottlenecks: BottleneckInfo[] = [];

    // Find phases that take more than 20% of total startup time
    const totalTime = phases.reduce(
      (sum, phase) => sum + (phase.duration ?? 0),
      0
    );
    const threshold = totalTime * 0.2;

    for (const phase of phases) {
      if (
        phase.duration != null &&
        phase.duration !== 0 &&
        phase.duration > threshold
      ) {
        bottlenecks.push({
          phase: phase.name,
          duration: phase.duration,
          percentage: (phase.duration / totalTime) * 100,
          impact: 'high',
          description: `Phase takes ${((phase.duration / totalTime) * 100).toFixed(1)}% of startup time`,
        });
      }
    }

    return bottlenecks.sort((a, b) => b.duration - a.duration);
  }

  private generateRecommendations(profile: StartupProfile): string[] {
    const recommendations: string[] = [];

    if (!profile.targetAnalysis.totalStartupTime.met) {
      recommendations.push(
        `Startup time (${profile.targetAnalysis.totalStartupTime.actual.toFixed(2)}ms) exceeds target (${profile.targetAnalysis.totalStartupTime.target}ms)`
      );
    }

    if (!profile.targetAnalysis.initializationTime.met) {
      recommendations.push(`Initialization time could be optimized`);
    }

    if (!profile.targetAnalysis.renderTime.met) {
      recommendations.push(`Initial render time could be improved`);
    }

    if (profile.errors.length > 0) {
      recommendations.push(
        `Address ${profile.errors.length} error(s) that occurred during startup`
      );
    }

    if (profile.warnings.length > 0) {
      recommendations.push(
        `Review ${profile.warnings.length} warning(s) for potential optimizations`
      );
    }

    return recommendations;
  }

  private categorizePerformance(
    actual: number,
    target: number
  ): 'excellent' | 'good' | 'fair' | 'poor' {
    const ratio = actual / target;

    if (ratio <= 0.5) return 'excellent';
    if (ratio <= 0.8) return 'good';
    if (ratio <= 1.2) return 'fair';
    return 'poor';
  }

  public updateConfig(newConfig: Partial<StartupProfilerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): StartupProfilerConfig {
    return { ...this.config };
  }

  private log(message: string): void {
    if (this.config.logToConsole) {
      const timestamp = (performance.now() - this.startTime).toFixed(2);
      console.log(`[${timestamp}ms] StartupProfiler: ${message}`);
    }
  }

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(
            `Error in startup profiler event handler for '${event}':`,
            error
          );
        }
      });
    }
  }
}

export interface PhaseOptions {
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface PhaseStatistics {
  longest: StartupPhase | null;
  shortest: StartupPhase | null;
  average: number;
  total: number;
}

export interface BottleneckInfo {
  phase: string;
  duration: number;
  percentage: number;
  impact: 'high' | 'medium' | 'low';
  description: string;
}

export interface StartupReport {
  profile: StartupProfile;
  statistics: {
    totalPhases: number;
    totalMilestones: number;
    longestPhase: StartupPhase | null;
    shortestPhase: StartupPhase | null;
    averagePhaseTime: number;
    totalPhaseTime: number;
  };
  bottlenecks: BottleneckInfo[];
  recommendations: string[];
  performance: {
    startup: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
    initialization: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
    rendering: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  };
}
