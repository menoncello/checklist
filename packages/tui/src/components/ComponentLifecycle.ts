import { ComponentInstanceEventHandler } from './ComponentInstanceEvents';
import {
  LifecyclePhase,
  LifecycleTransition,
  LifecycleHooks,
  LifecycleValidationResult,
  LifecycleMetrics,
} from './ComponentLifecycleTypes';
import { ComponentLifecycleUtils } from './ComponentLifecycleUtils';
import { ComponentLifecycleValidator } from './ComponentLifecycleValidator';

export * from './ComponentLifecycleTypes';

export class ComponentLifecycle {
  private componentId: string;
  private currentPhase: LifecyclePhase = 'created';
  private previousPhase: LifecyclePhase | null = null;
  private createdAt: number;
  private lastTransitionTime: number;
  private transitionHistory: LifecycleTransition[] = [];
  private maxHistorySize: number = 50;
  private eventHandler = new ComponentInstanceEventHandler();
  private hooks: LifecycleHooks = {};
  private error: Error | null = null;
  private phaseStartTime: number = 0;

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
    ComponentLifecycleValidator.validateInitialization(this.componentId);
  }

  public setPhase(newPhase: LifecyclePhase): void {
    if (newPhase === this.currentPhase) return;

    if (
      !ComponentLifecycleUtils.isValidTransition(this.currentPhase, newPhase)
    ) {
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
      const safePhase = ComponentLifecycleUtils.getSafePhaseForRecovery();
      this.transitionToPhase(safePhase);
    }
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
    return ComponentLifecycleUtils.isValidTransition(this.currentPhase, phase);
  }

  public getValidNextPhases(): LifecyclePhase[] {
    return (
      ComponentLifecycleUtils.VALID_TRANSITIONS.get(this.currentPhase) ?? []
    );
  }

  public isInPhase(phase: LifecyclePhase): boolean {
    return this.currentPhase === phase;
  }

  public isInActivePhase(): boolean {
    return ComponentLifecycleUtils.isInActivePhase(this.currentPhase);
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

  public getMetrics(): LifecycleMetrics {
    return ComponentLifecycleUtils.collectMetrics({
      componentId: this.componentId,
      currentPhase: this.currentPhase,
      previousPhase: this.previousPhase,
      timing: {
        createdAt: this.createdAt,
        phaseStartTime: this.phaseStartTime,
        lastTransitionTime: this.lastTransitionTime,
      },
      transitionHistory: this.transitionHistory,
      error: {
        hasError: this.hasError(),
        error: this.error,
      },
      getValidNextPhases: () => this.getValidNextPhases(),
    });
  }

  public validate(): LifecycleValidationResult {
    return ComponentLifecycleValidator.validate(
      this.currentPhase,
      this.transitionHistory,
      () => this.getTimeInCurrentPhase(),
      () => this.getValidNextPhases()
    );
  }

  public destroy(): void {
    this.setPhase('destroying');

    // Clear all event handlers
    this.eventHandler.clear();

    // Clear hooks
    this.hooks = {};

    // Clear error
    this.error = null;

    this.setPhase('destroyed');
  }

  public on(event: string, handler: Function): void {
    this.eventHandler.on(event, handler);
  }

  public off(event: string, handler: Function): void {
    this.eventHandler.off(event, handler);
  }

  private emit(event: string, data?: unknown): void {
    this.eventHandler.emit(event, data);
  }
}
