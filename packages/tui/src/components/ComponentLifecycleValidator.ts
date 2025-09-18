import {
  LifecyclePhase,
  LifecycleTransition,
  LifecycleValidationResult,
} from './ComponentLifecycleTypes';

export class ComponentLifecycleValidator {
  static validate(
    currentPhase: LifecyclePhase,
    transitionHistory: LifecycleTransition[],
    getTimeInCurrentPhase: () => number,
    getValidNextPhases: () => LifecyclePhase[]
  ): LifecycleValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    this.validateErrorState(currentPhase, getTimeInCurrentPhase, warnings);
    this.validateTransitionHistory(transitionHistory, warnings);
    this.validateDestroyedState(currentPhase, getValidNextPhases, errors);
    this.validatePhaseTimeout(currentPhase, getTimeInCurrentPhase, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private static validateErrorState(
    currentPhase: LifecyclePhase,
    getTimeInCurrentPhase: () => number,
    warnings: string[]
  ): void {
    if (currentPhase === 'error' && getTimeInCurrentPhase() > 30000) {
      warnings.push('Component stuck in error state for over 30 seconds');
    }
  }

  private static validateTransitionHistory(
    transitionHistory: LifecycleTransition[],
    warnings: string[]
  ): void {
    const errorTransitions = transitionHistory.filter(
      (t) => t.to === 'error'
    ).length;
    if (errorTransitions > 5) {
      warnings.push(`High error count: ${errorTransitions} error transitions`);
    }
  }

  private static validateDestroyedState(
    currentPhase: LifecyclePhase,
    getValidNextPhases: () => LifecyclePhase[],
    errors: string[]
  ): void {
    if (currentPhase === 'destroyed' && getValidNextPhases().length > 0) {
      errors.push('Destroyed component should not have valid next phases');
    }
  }

  private static validatePhaseTimeout(
    currentPhase: LifecyclePhase,
    getTimeInCurrentPhase: () => number,
    warnings: string[]
  ): void {
    if (getTimeInCurrentPhase() > 300000) {
      warnings.push(
        `Component stuck in '${currentPhase}' phase for over 5 minutes`
      );
    }
  }

  static validateInitialization(componentId: string): void {
    if (!componentId || componentId.trim() === '') {
      throw new Error('Component ID is required for initialization');
    }
  }
}
