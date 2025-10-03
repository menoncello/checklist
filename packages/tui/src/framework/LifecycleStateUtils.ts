import type { LifecyclePhase } from './LifecycleTypes';
import type { LifecycleState } from './UIFramework';

export class LifecycleStateUtils {
  public static getComponentCount(state: LifecycleState): number {
    return state.components.size;
  }

  public static isRunning(state: LifecycleState): boolean {
    return state.phase === 'running';
  }

  public static isShuttingDown(state: LifecycleState): boolean {
    return state.phase === 'shutting-down';
  }

  public static isStopped(state: LifecycleState): boolean {
    return state.phase === 'stopped';
  }

  public static getUptime(state: LifecycleState): number {
    if (state.startTime === 0) {
      return 0;
    }
    return Date.now() - state.startTime;
  }

  public static hasError(state: LifecycleState): boolean {
    return state.errorState !== undefined;
  }

  public static getError(state: LifecycleState): Error | undefined {
    return state.errorState;
  }

  public static clearError(state: LifecycleState): void {
    state.errorState = undefined;
  }

  public static setErrorState(state: LifecycleState, error: Error): void {
    state.errorState = error;
  }

  public static canTransition(
    from: LifecyclePhase,
    to: LifecyclePhase
  ): boolean {
    const validTransitions: Record<LifecyclePhase, LifecyclePhase[]> = {
      stopped: ['initializing'],
      initializing: ['running', 'stopped', 'shutting-down'],
      running: ['shutting-down', 'stopped'],
      'shutting-down': ['stopped'],
    };

    return validTransitions[from]?.includes(to) ?? false;
  }

  public static validatePhaseTransition(
    from: LifecyclePhase,
    to: LifecyclePhase
  ): void {
    if (!LifecycleStateUtils.canTransition(from, to)) {
      throw new Error(`Invalid phase transition: ${from} -> ${to}`);
    }
  }
}
