export type LifecyclePhase =
  | 'created'
  | 'initializing'
  | 'initialized'
  | 'mounting'
  | 'mounted'
  | 'rendering'
  | 'rendered'
  | 'updating'
  | 'updated'
  | 'unmounting'
  | 'unmounted'
  | 'destroying'
  | 'destroyed'
  | 'error';

export interface LifecycleTransition {
  from: LifecyclePhase;
  to: LifecyclePhase;
  timestamp: number;
  duration?: number;
  error?: Error;
}

export interface LifecycleHooks {
  onPhaseChange?: (from: LifecyclePhase, to: LifecyclePhase) => void;
  onError?: (error: Error, phase: LifecyclePhase) => void;
  onTransition?: (transition: LifecycleTransition) => void;
}

export interface LifecycleState {
  currentPhase: LifecyclePhase;
  previousPhase: LifecyclePhase | null;
  transitionHistory: LifecycleTransition[];
  error: Error | null;
  createdAt: number;
  lastTransitionTime: number;
}

export type LifecycleHook = (phase: LifecyclePhase, data?: unknown) => void;
export type LifecyclePhaseTransition = LifecycleTransition;

export interface LifecycleEvent {
  type: string;
  phase: LifecyclePhase;
  timestamp: number;
  data?: unknown;
}

export class ComponentLifecycle {
  private componentId: string;
  private currentPhase: LifecyclePhase = 'created';
  private previousPhase: LifecyclePhase | null = null;
  private createdAt: number;
  private lastTransitionTime: number;
  private transitionHistory: LifecycleTransition[] = [];
  private maxHistorySize: number = 50;
  private eventHandlers = new Map<string, Set<Function>>();
  private hooks: LifecycleHooks = {};
  private error: Error | null = null;
  private phaseStartTime: number = 0;

  // Valid phase transitions
  private readonly validTransitions: Map<LifecyclePhase, LifecyclePhase[]> =
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

  constructor(componentId: string, hooks?: LifecycleHooks) {
    this.componentId = componentId;
    this.createdAt = Date.now();
    this.lastTransitionTime = this.createdAt;
    this.phaseStartTime = this.createdAt;
    this.hooks = hooks ?? {};
  }

  public initialize(): void {
    this.setPhase('initializing');

    try {
      // Perform initialization logic
      this.validateInitialization();
      this.setPhase('initialized');
    } catch (error) {
      this.setError(error as Error);
      throw error;
    }
  }

  private validateInitialization(): void {
    if (!this.componentId || this.componentId.trim() === '') {
      throw new Error('Component ID is required for initialization');
    }
  }

  public setPhase(newPhase: LifecyclePhase): void {
    if (newPhase === this.currentPhase) return;

    if (!this.isValidTransition(this.currentPhase, newPhase)) {
      const error = new Error(
        `Invalid lifecycle transition from '${this.currentPhase}' to '${newPhase}' for component '${this.componentId}'`
      );
      this.setError(error);
      throw error;
    }

    this.transitionToPhase(newPhase);
  }

  private transitionToPhase(newPhase: LifecyclePhase): void {
    const now = Date.now();
    const transition: LifecycleTransition = {
      from: this.currentPhase,
      to: newPhase,
      timestamp: now,
      duration: now - this.phaseStartTime,
    };

    // Update state
    this.previousPhase = this.currentPhase;
    this.currentPhase = newPhase;
    this.lastTransitionTime = now;
    this.phaseStartTime = now;

    // Record transition
    this.recordTransition(transition);

    // Execute hooks
    this.executeHooks(transition);

    // Emit events
    this.emit('phaseChange', {
      from: transition.from,
      to: transition.to,
      timestamp: transition.timestamp,
      duration: transition.duration,
    });

    this.emit('transition', transition);
  }

  private isValidTransition(from: LifecyclePhase, to: LifecyclePhase): boolean {
    const validToPhases = this.validTransitions.get(from);
    return validToPhases ? validToPhases.includes(to) : false;
  }

  private recordTransition(transition: LifecycleTransition): void {
    this.transitionHistory.push(transition);

    // Trim history if it exceeds max size
    if (this.transitionHistory.length > this.maxHistorySize) {
      this.transitionHistory = this.transitionHistory.slice(
        -this.maxHistorySize
      );
    }
  }

  private executeHooks(transition: LifecycleTransition): void {
    try {
      if (this.hooks.onPhaseChange) {
        this.hooks.onPhaseChange(transition.from, transition.to);
      }

      if (this.hooks.onTransition) {
        this.hooks.onTransition(transition);
      }
    } catch (error) {
      console.error(
        `Error executing lifecycle hooks for component '${this.componentId}':`,
        error
      );
    }
  }

  public setError(error: Error): void {
    this.error = error;

    // Transition to error phase if not already there
    if (this.currentPhase !== 'error') {
      try {
        this.previousPhase = this.currentPhase;
        this.currentPhase = 'error';
        this.lastTransitionTime = Date.now();

        const transition: LifecycleTransition = {
          from: this.previousPhase,
          to: 'error',
          timestamp: this.lastTransitionTime,
          error,
        };

        this.recordTransition(transition);

        // Execute error hook
        if (this.hooks.onError) {
          this.hooks.onError(error, this.previousPhase);
        }

        this.emit('error', { error, previousPhase: this.previousPhase });
      } catch (hookError) {
        console.error(
          `Error handling lifecycle error for component '${this.componentId}':`,
          hookError
        );
      }
    }
  }

  public clearError(): void {
    if (this.currentPhase === 'error' && this.previousPhase) {
      this.error = null;

      // Attempt to return to a safe phase
      const safePhase = this.getSafePhaseForRecovery();
      this.transitionToPhase(safePhase);
    }
  }

  private getSafePhaseForRecovery(): LifecyclePhase {
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

  public getCurrentPhase(): LifecyclePhase {
    return this.currentPhase;
  }

  public getPreviousPhase(): LifecyclePhase | null {
    return this.previousPhase;
  }

  public hasError(): boolean {
    return this.error !== null;
  }

  public getError(): Error | null {
    return this.error;
  }

  public getTransitionHistory(): LifecycleTransition[] {
    return [...this.transitionHistory];
  }

  public getAge(): number {
    return Date.now() - this.createdAt;
  }

  public getTimeInCurrentPhase(): number {
    return Date.now() - this.phaseStartTime;
  }

  public getTimeSinceLastTransition(): number {
    return Date.now() - this.lastTransitionTime;
  }

  public canTransitionTo(phase: LifecyclePhase): boolean {
    return this.isValidTransition(this.currentPhase, phase);
  }

  public getValidNextPhases(): LifecyclePhase[] {
    return this.validTransitions.get(this.currentPhase) ?? [];
  }

  public isInPhase(phase: LifecyclePhase): boolean {
    return this.currentPhase === phase;
  }

  public isInActivePhase(): boolean {
    return ['mounted', 'rendering', 'rendered', 'updating', 'updated'].includes(
      this.currentPhase
    );
  }

  public isInDestroyedState(): boolean {
    return this.currentPhase === 'destroyed';
  }

  public isInErrorState(): boolean {
    return this.currentPhase === 'error';
  }

  public setHooks(hooks: LifecycleHooks): void {
    this.hooks = { ...this.hooks, ...hooks };
  }

  public removeHooks(): void {
    this.hooks = {};
  }

  public getMetrics() {
    const history = this.transitionHistory;
    const phaseDistribution = this.getPhaseDistribution();
    const averagePhaseTime = this.getAveragePhaseTime();

    return {
      componentId: this.componentId,
      currentPhase: this.currentPhase,
      previousPhase: this.previousPhase,
      age: this.getAge(),
      timeInCurrentPhase: this.getTimeInCurrentPhase(),
      timeSinceLastTransition: this.getTimeSinceLastTransition(),
      transitionCount: history.length,
      errorCount: history.filter((t) => t.to === 'error').length,
      hasError: this.hasError(),
      error: this.error?.message,
      phaseDistribution,
      averagePhaseTime,
      isInActivePhase: this.isInActivePhase(),
      isInDestroyedState: this.isInDestroyedState(),
      validNextPhases: this.getValidNextPhases(),
    };
  }

  private getPhaseDistribution(): Record<LifecyclePhase, number> {
    const distribution: Partial<Record<LifecyclePhase, number>> = {};

    this.transitionHistory.forEach((transition) => {
      distribution[transition.to] = (distribution[transition.to] ?? 0) + 1;
    });

    return distribution as Record<LifecyclePhase, number>;
  }

  private getAveragePhaseTime(): number {
    const transitionsWithDuration = this.transitionHistory.filter(
      (t) => t.duration !== undefined
    );

    if (transitionsWithDuration.length === 0) return 0;

    const totalTime = transitionsWithDuration.reduce(
      (sum, t) => sum + (t.duration ?? 0),
      0
    );
    return totalTime / transitionsWithDuration.length;
  }

  public validate(): LifecycleValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for stuck in error state
    if (this.currentPhase === 'error' && this.getTimeInCurrentPhase() > 30000) {
      warnings.push('Component stuck in error state for over 30 seconds');
    }

    // Check for too many error transitions
    const errorTransitions = this.transitionHistory.filter(
      (t) => t.to === 'error'
    ).length;
    if (errorTransitions > 5) {
      warnings.push(`High error count: ${errorTransitions} error transitions`);
    }

    // Check for invalid state
    if (
      this.currentPhase === 'destroyed' &&
      this.getValidNextPhases().length > 0
    ) {
      errors.push('Destroyed component should not have valid next phases');
    }

    // Check for long time in single phase
    if (this.getTimeInCurrentPhase() > 300000) {
      // 5 minutes
      warnings.push(
        `Component stuck in '${this.currentPhase}' phase for over 5 minutes`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  public destroy(): void {
    this.setPhase('destroying');

    // Clear all event handlers
    this.eventHandlers.clear();

    // Clear hooks
    this.hooks = {};

    // Clear error
    this.error = null;

    this.setPhase('destroyed');
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
            `Error in lifecycle event handler for '${event}':`,
            error
          );
        }
      });
    }
  }
}

export interface LifecycleValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
