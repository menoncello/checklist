import type {
  StartupPhase,
  StartupMilestone,
  StartupProfilerConfig,
  StartupProfile,
  PhaseOptions,
  StartupReport,
  BottleneckInfo,
} from './types/StartupProfilerTypes.js';
import { StartupBottleneckDetector } from './utils/StartupBottleneckDetector.js';
import { StartupTargetAnalyzer } from './utils/StartupTargetAnalyzer.js';

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
    this.config = this.createConfig(config);
    this.startTime = performance.now();
    this.log('StartupProfiler: Startup profiling initiated');

    if (this.config.enableProfiling) {
      this.setupDefaultPhases();
    }
  }

  private createConfig(
    config: Partial<StartupProfilerConfig>
  ): StartupProfilerConfig {
    return {
      enableProfiling: true,
      enableDetailedProfiling: false,
      trackSubPhases: true,
      maxPhaseDepth: 5,
      enableMilestones: true,
      logToConsole: false,
      target: {
        totalStartupTime: 100,
        initializationTime: 50,
        renderTime: 50,
      },
      ...config,
    };
  }

  private setupDefaultPhases(): void {
    this.startPhase('framework_init', {
      description: 'Framework initialization and setup',
      metadata: { category: 'initialization' },
    });
  }

  public startPhase(name: string, options: PhaseOptions = {}): void {
    if (!this.config.enableProfiling || this.completed) return;

    if (this.phaseStack.length >= this.config.maxPhaseDepth) {
      this.addWarning(
        `Maximum phase depth (${this.config.maxPhaseDepth}) exceeded for phase: ${name}`
      );
      return;
    }

    const phase: StartupPhase = this.createPhase(name, options);
    this.phases.set(name, phase);
    this.phaseStack.push(name);

    this.addToParentSubPhases(phase);
    this.log(`Started phase: ${name}`);
    this.emit('phaseStarted', { phase });
  }

  private createPhase(name: string, options: PhaseOptions): StartupPhase {
    return {
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
  }

  private addToParentSubPhases(phase: StartupPhase): void {
    if (
      !this.config.trackSubPhases ||
      phase.parent == null ||
      phase.parent === ''
    )
      return;

    const parent = this.phases.get(phase.parent);
    if (parent?.subPhases != null) {
      parent.subPhases.push(phase);
    }
  }

  public endPhase(name: string): StartupPhase | null {
    if (!this.config.enableProfiling || this.completed) return null;

    const phase = this.phases.get(name);
    if (!phase) {
      this.addError(`Attempted to end non-existent phase: ${name}`);
      return null;
    }

    if (phase.endTime != null) {
      this.addWarning(`Phase already ended: ${name}`);
      return phase;
    }

    return this.finalizePhase(phase);
  }

  private finalizePhase(phase: StartupPhase): StartupPhase {
    phase.endTime = performance.now();
    phase.duration = phase.endTime - phase.startTime;

    // Remove from stack
    const stackIndex = this.phaseStack.indexOf(phase.name);
    if (stackIndex !== -1) {
      this.phaseStack.splice(stackIndex, 1);
    }

    this.log(`Ended phase: ${phase.name} (${phase.duration.toFixed(2)}ms)`);
    this.emit('phaseEnded', { phase });

    return phase;
  }

  public addMilestone(
    name: string,
    description?: string,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.config.enableMilestones || this.completed) return;

    this.milestones.push({
      name,
      timestamp: performance.now(),
      description,
      metadata,
    });

    this.log(`Milestone reached: ${name}`);
    this.emit('milestone', { milestone: { name, description, metadata } });
  }

  public complete(): StartupProfile {
    if (this.completed) {
      this.addWarning('Profiler already completed');
      return this.buildProfile();
    }

    this.endAllOpenPhases();
    this.completed = true;

    const profile = this.buildProfile();
    this.log(
      `Startup profiling completed in ${profile.totalDuration?.toFixed(2)}ms`
    );
    this.emit('startupComplete', { profile });

    return profile;
  }

  private endAllOpenPhases(): void {
    while (this.phaseStack.length > 0) {
      const phaseName = this.phaseStack[this.phaseStack.length - 1];
      this.endPhase(phaseName);
    }
  }

  private buildProfile(): StartupProfile {
    const endTime = performance.now();
    const totalDuration = endTime - this.startTime;

    const targetAnalysis = StartupTargetAnalyzer.analyzeTargets(
      this.phases,
      this.config,
      totalDuration
    );

    const additionalWarnings =
      StartupTargetAnalyzer.generateTargetWarnings(targetAnalysis);
    this.warnings.push(...additionalWarnings);

    return {
      startTime: this.startTime,
      endTime,
      totalDuration,
      phases: Array.from(this.phases.values()),
      milestones: [...this.milestones],
      warnings: [...this.warnings],
      errors: [...this.errors],
      meetsTargets: StartupTargetAnalyzer.meetsAllTargets(targetAnalysis),
      targetAnalysis,
    };
  }

  public isCompleted(): boolean {
    return this.completed;
  }

  public generateReport(): StartupReport {
    const profile = this.buildProfile();
    const statistics = StartupBottleneckDetector.calculatePhaseStatistics(
      this.phases
    );
    const bottlenecks = StartupBottleneckDetector.detectBottlenecks(
      this.phases,
      statistics
    );

    const performanceScore =
      StartupBottleneckDetector.calculatePerformanceScore(
        profile.totalDuration ?? 0,
        this.config.target.totalStartupTime,
        bottlenecks
      );

    return {
      profile,
      statistics,
      bottlenecks,
      performanceScore,
      recommendations: this.generateRecommendations(bottlenecks),
      performance: {
        startup: this.categorizePerformance(
          profile.totalDuration ?? 0,
          bottlenecks
        ),
      },
    };
  }

  private generateRecommendations(bottlenecks: BottleneckInfo[]): string[] {
    const recommendations: string[] = [];
    const profile = this.buildProfile();
    const totalDuration = profile.totalDuration ?? 0;
    const target = this.config.target.totalStartupTime;

    if (totalDuration > target) {
      recommendations.push(
        `Total startup time ${totalDuration.toFixed(2)}ms exceeds target ${target}ms`
      );
    }

    if (bottlenecks.length === 0) {
      if (totalDuration <= target) {
        recommendations.push(
          'Excellent performance! All phases are within acceptable limits.'
        );
      }
    } else {
      recommendations.push('Consider the following optimizations:');
      bottlenecks.forEach((bottleneck) => {
        recommendations.push(`- ${bottleneck.recommendation}`);
      });
    }

    return recommendations;
  }

  private categorizePerformance(
    totalDuration: number,
    bottlenecks: BottleneckInfo[]
  ): string {
    const target = this.config.target.totalStartupTime;
    const ratio = target > 0 ? totalDuration / target : 0;

    if (bottlenecks.length === 0 && ratio <= 0.5) {
      return 'excellent';
    } else if (ratio <= 0.8) {
      return 'good';
    } else if (ratio <= 1.2) {
      return 'fair';
    } else if (ratio <= 2.0) {
      return 'poor';
    } else {
      return 'unknown';
    }
  }

  // Event handling methods
  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.add(handler);
    }
  }

  private emit(event: string, data: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          this.addError(`Event handler error: ${error}`);
          console.error(
            `[StartupProfiler] Event handler error in ${event}:`,
            error
          );
        }
      });
    }
  }

  // Public getter methods
  public getConfig(): StartupProfilerConfig {
    return { ...this.config };
  }

  public getPhase(name: string): StartupPhase | null {
    return this.phases.get(name) ?? null;
  }

  public getPhases(): StartupPhase[] {
    return Array.from(this.phases.values());
  }

  public getCurrentPhase(): string | null {
    return this.phaseStack.length > 0
      ? this.phaseStack[this.phaseStack.length - 1]
      : null;
  }

  public getWarnings(): string[] {
    return [...this.warnings];
  }

  public getErrors(): string[] {
    return [...this.errors];
  }

  public getMilestones(): StartupMilestone[] {
    return [...this.milestones];
  }

  public getUptime(): number {
    return performance.now() - this.startTime;
  }

  public getDuration(phaseName: string): number {
    const phase = this.phases.get(phaseName);
    if (!phase) return 0;

    if (phase.duration != null) {
      return phase.duration;
    }

    if (phase.endTime != null) {
      return phase.endTime - phase.startTime;
    }

    return 0;
  }

  public getTotalDuration(): number {
    const rootPhases = this.getPhases().filter(
      (p) => p.parent == null || p.parent === ''
    );
    return rootPhases.reduce((total, phase) => {
      return total + (phase.duration ?? 0);
    }, 0);
  }

  public getBreakdown(): Record<string, number> {
    const breakdown: Record<string, number> = {};
    this.getPhases().forEach((phase) => {
      breakdown[phase.name] = phase.duration ?? 0;
    });
    return breakdown;
  }

  public getSlowPhases(threshold = 50): string[] {
    return this.getPhases()
      .filter((phase) => (phase.duration ?? 0) > threshold)
      .map((phase) => phase.name);
  }

  public getActivePhases(): string[] {
    return [...this.phaseStack];
  }

  public getAllPhases(): StartupPhase[] {
    return this.getPhases();
  }

  public getTotalTime(): number {
    return this.getTotalDuration();
  }

  // Convenience aliases
  public start(name: string, options: PhaseOptions = {}): void {
    this.startPhase(name, options);
  }

  public end(name: string): StartupPhase | null {
    return this.endPhase(name);
  }

  public completeStartup(): StartupProfile {
    return this.complete();
  }

  // Measurement utilities
  public measure<T>(name: string, fn: () => T): T {
    this.startPhase(name);
    try {
      const result = fn();
      this.endPhase(name);
      return result;
    } catch (error) {
      this.endPhase(name);
      throw error;
    }
  }

  public async measureAsync<T>(
    promise: Promise<T>,
    name: string,
    description?: string
  ): Promise<T> {
    this.startPhase(name, { description });
    try {
      const result = await promise;
      this.endPhase(name);
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.addError(`Error in async phase ${name}: ${errorMessage}`);
      this.endPhase(name);
      throw error;
    }
  }

  public measureFunction<T extends (...args: unknown[]) => unknown>(
    fn: T,
    phaseName: string,
    description?: string
  ): T {
    const wrappedFn = ((...args: Parameters<T>) => {
      this.startPhase(phaseName, { description });
      try {
        const result = fn(...args);
        this.endPhase(phaseName);
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.addError(`Error in phase ${phaseName}: ${errorMessage}`);
        this.endPhase(phaseName);
        throw error;
      }
    }) as T;

    return wrappedFn;
  }

  public measureAsyncFunction<
    T extends (...args: unknown[]) => Promise<unknown>,
  >(fn: T, phaseName: string, description?: string): T {
    const wrappedFn = (async (...args: Parameters<T>) => {
      this.startPhase(phaseName, { description });
      try {
        const result = await fn(...args);
        this.endPhase(phaseName);
        return result;
      } catch (error) {
        this.endPhase(phaseName);
        throw error;
      }
    }) as T;

    return wrappedFn;
  }

  public updateConfig(config: Partial<StartupProfilerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    }
  }

  // Utility methods
  private addWarning(message: string): void {
    this.warnings.push(message);
    this.emit('warning', { message });
  }

  private addError(message: string): void {
    this.errors.push(message);
    this.emit('error', { message });
  }

  private log(message: string): void {
    if (this.config.logToConsole) {
      console.log(`[StartupProfiler] ${message}`);
    }
  }
}

// Re-export types for convenience
export * from './types/StartupProfilerTypes.js';
