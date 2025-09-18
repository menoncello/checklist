import { createLogger, type Logger } from '../utils/logger';
import { WorkflowState, Step, CompletedStep, SkippedStep } from './types';

/**
 * Helper for workflow navigation operations
 */
export class NavigationHelper {
  private logger: Logger;

  constructor() {
    this.logger = createLogger('checklist:workflow:navigation-helper');
  }

  /**
   * Create a completed step from current step
   */
  createCompletedStep(currentStep: Step, state: WorkflowState): CompletedStep {
    return {
      step: currentStep,
      completedAt: new Date(),
      duration: this.calculateDuration(state.startedAt?.toString()),
    };
  }

  /**
   * Create a skipped step
   */
  createSkippedStep(step: Step, reason: string): SkippedStep {
    return {
      step,
      reason,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate step duration
   */
  private calculateDuration(startedAt?: string): number {
    if (startedAt == null || startedAt === '') return 0;
    return Date.now() - new Date(startedAt).getTime();
  }

  /**
   * Find next valid step index
   */
  findNextValidStepIndex(
    currentIndex: number,
    steps: Step[],
    variables: Record<string, unknown>
  ): number {
    for (let i = currentIndex + 1; i < steps.length; i++) {
      const step = steps[i];
      if (this.shouldShowStep(step, variables)) {
        return i;
      }
    }
    return -1; // No more valid steps
  }

  /**
   * Check if step should be shown based on conditions
   */
  shouldShowStep(step: Step, variables: Record<string, unknown>): boolean {
    if (step.condition == null || step.condition === '') return true;

    try {
      // Import safeEval dynamically to avoid circular dependency
      const { safeEval } = require('./conditions');
      return safeEval(step.condition, variables);
    } catch (error) {
      this.logger.warn({
        msg: 'Failed to evaluate step condition',
        step: step.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Log step advancement
   */
  logAdvancement(
    previousState: WorkflowState,
    newState: WorkflowState,
    nextStep: Step | null
  ): void {
    this.logger.info({
      msg: 'Workflow advanced',
      from: previousState.currentStepIndex,
      to: newState.currentStepIndex,
      status: newState.status,
      nextStep: nextStep?.id ?? 'none',
    });
  }

  /**
   * Log step skip
   */
  logSkip(step: Step, reason: string): void {
    this.logger.info({
      msg: 'Step skipped',
      step: step.id,
      reason,
    });
  }

  /**
   * Log workflow completion
   */
  logCompletion(state: WorkflowState): void {
    this.logger.info({
      msg: 'Workflow completed',
      totalSteps: state.completedSteps.length,
      skippedSteps: state.skippedSteps.length,
    });
  }
}
