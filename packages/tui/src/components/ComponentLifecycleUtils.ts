import {
  LifecyclePhase,
  LifecycleTransition,
  LifecycleMetrics,
} from './ComponentLifecycleTypes';

export class ComponentLifecycleUtils {
  static readonly VALID_TRANSITIONS: Map<LifecyclePhase, LifecyclePhase[]> =
    new Map([
      ['created', ['initializing']],
      ['initializing', ['initialized', 'error']],
      ['initialized', ['mounting', 'destroying', 'error']],
      ['mounting', ['mounted', 'error']],
      ['mounted', ['rendering', 'updating', 'unmounting', 'error']],
      ['rendering', ['rendered', 'error']],
      ['rendered', ['rendering', 'updating', 'unmounting', 'error']],
      ['updating', ['updated', 'error']],
      ['updated', ['rendering', 'updating', 'unmounting', 'error']],
      ['unmounting', ['unmounted', 'error']],
      ['unmounted', ['mounting', 'destroying', 'error']],
      ['destroying', ['destroyed', 'error']],
      ['destroyed', []],
      ['error', ['destroying', 'unmounting', 'initialized']],
    ]);

  static isValidTransition(from: LifecyclePhase, to: LifecyclePhase): boolean {
    const validToPhases = this.VALID_TRANSITIONS.get(from);
    return validToPhases ? validToPhases.includes(to) : false;
  }

  static getSafePhaseForRecovery(): LifecyclePhase {
    // Prioritize returning to initialized state for recovery
    if (this.isValidTransition('error', 'initialized')) {
      return 'initialized';
    }

    // Fall back to unmounting for cleanup
    if (this.isValidTransition('error', 'unmounting')) {
      return 'unmounting';
    }

    // Last resort: destroying
    return 'destroying';
  }

  static isInActivePhase(phase: LifecyclePhase): boolean {
    return ['mounted', 'rendering', 'rendered', 'updating', 'updated'].includes(
      phase
    );
  }

  static getPhaseDistribution(
    transitionHistory: LifecycleTransition[]
  ): Record<LifecyclePhase, number> {
    const distribution: Partial<Record<LifecyclePhase, number>> = {};

    transitionHistory.forEach((transition) => {
      distribution[transition.to] = (distribution[transition.to] ?? 0) + 1;
    });

    return distribution as Record<LifecyclePhase, number>;
  }

  static getAveragePhaseTime(transitionHistory: LifecycleTransition[]): number {
    const transitionsWithDuration = transitionHistory.filter(
      (t) => t.duration !== undefined
    );

    if (transitionsWithDuration.length === 0) return 0;

    const totalTime = transitionsWithDuration.reduce(
      (sum, t) => sum + (t.duration ?? 0),
      0
    );
    return totalTime / transitionsWithDuration.length;
  }

  static collectMetrics(options: {
    componentId: string;
    currentPhase: LifecyclePhase;
    previousPhase: LifecyclePhase | null;
    timing: {
      createdAt: number;
      phaseStartTime: number;
      lastTransitionTime: number;
    };
    transitionHistory: LifecycleTransition[];
    error: {
      hasError: boolean;
      error: Error | null;
    };
    getValidNextPhases: () => LifecyclePhase[];
  }): LifecycleMetrics {
    const basicMetrics = this.calculateBasicMetrics(options);
    const historyMetrics = this.calculateHistoryMetrics(
      options.transitionHistory
    );
    const phaseMetrics = this.calculatePhaseMetrics(
      options.currentPhase,
      options.getValidNextPhases
    );

    return {
      ...basicMetrics,
      ...historyMetrics,
      ...phaseMetrics,
    };
  }

  private static calculateBasicMetrics(options: {
    componentId: string;
    currentPhase: LifecyclePhase;
    previousPhase: LifecyclePhase | null;
    timing: {
      createdAt: number;
      phaseStartTime: number;
      lastTransitionTime: number;
    };
    error: { hasError: boolean; error: Error | null };
  }) {
    const now = Date.now();
    const { timing, error } = options;

    return {
      componentId: options.componentId,
      currentPhase: options.currentPhase,
      previousPhase: options.previousPhase,
      age: now - timing.createdAt,
      timeInCurrentPhase: now - timing.phaseStartTime,
      timeSinceLastTransition: now - timing.lastTransitionTime,
      hasError: error.hasError,
      error: error.error?.message,
    };
  }

  private static calculateHistoryMetrics(
    transitionHistory: LifecycleTransition[]
  ) {
    const phaseDistribution = this.getPhaseDistribution(transitionHistory);
    const averagePhaseTime = this.getAveragePhaseTime(transitionHistory);

    return {
      transitionCount: transitionHistory.length,
      errorCount: transitionHistory.filter((t) => t.to === 'error').length,
      phaseDistribution,
      averagePhaseTime,
    };
  }

  private static calculatePhaseMetrics(
    currentPhase: LifecyclePhase,
    getValidNextPhases: () => LifecyclePhase[]
  ) {
    return {
      isInActivePhase: this.isInActivePhase(currentPhase),
      isInDestroyedState: currentPhase === 'destroyed',
      validNextPhases: getValidNextPhases(),
    };
  }
}
