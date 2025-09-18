import {
  WorkflowState,
  ChecklistTemplate,
  CompletedStep,
  SkippedStep,
  Summary,
} from './types';

/**
 * Helper for managing workflow state transitions
 */
export class WorkflowStateManager {
  /**
   * Complete the current step
   */
  completeCurrentStep(
    state: WorkflowState,
    completedStep: CompletedStep,
    _template: ChecklistTemplate
  ): WorkflowState {
    const updatedState: WorkflowState = {
      ...state,
      completedSteps: [...state.completedSteps, completedStep],
    };

    return updatedState;
  }

  /**
   * Skip a step
   */
  skipStep(state: WorkflowState, skippedStep: SkippedStep): WorkflowState {
    return {
      ...state,
      skippedSteps: [...state.skippedSteps, skippedStep],
    };
  }

  /**
   * Move to next step
   */
  moveToStep(state: WorkflowState, stepIndex: number): WorkflowState {
    if (stepIndex === -1) {
      return this.completeWorkflow(state);
    }

    return {
      ...state,
      currentStepIndex: stepIndex,
    };
  }

  /**
   * Complete the workflow
   */
  completeWorkflow(state: WorkflowState): WorkflowState {
    return {
      ...state,
      status: 'completed',
      completedAt: new Date(),
      currentStepIndex: -1,
    };
  }

  /**
   * Create workflow summary
   */
  createSummary(state: WorkflowState): Summary {
    const duration = this.calculateTotalDuration(state);

    return {
      templateId: state.templateId ?? '',
      instanceId: state.instanceId ?? '',
      startedAt: state.startedAt ?? new Date(),
      completedAt: state.completedAt ?? new Date(),
      duration,
      completedSteps: state.completedSteps.length,
      skippedSteps: state.skippedSteps.length,
      totalSteps: state.completedSteps.length + state.skippedSteps.length,
      status: state.status === 'completed' ? 'completed' : 'failed',
    };
  }

  /**
   * Calculate progress percentage
   */
  private calculateProgress(completed: number, total: number): number {
    if (total === 0) return 100;
    return Math.round((completed / total) * 100);
  }

  /**
   * Calculate total workflow duration
   */
  private calculateTotalDuration(state: WorkflowState): number {
    if (!state.startedAt) return 0;

    const endTime = state.completedAt
      ? new Date(state.completedAt).getTime()
      : Date.now();

    return endTime - new Date(state.startedAt).getTime();
  }

  /**
   * Update workflow variables
   */
  updateVariables(
    state: WorkflowState,
    newVariables: Record<string, unknown>
  ): WorkflowState {
    return {
      ...state,
      variables: {
        ...state.variables,
        ...newVariables,
      },
    };
  }

  /**
   * Reset workflow to initial state
   */
  resetWorkflow(_template: ChecklistTemplate): WorkflowState {
    return {
      currentStepIndex: 0,
      completedSteps: [],
      skippedSteps: [],
      variables: {},
      startedAt: new Date(),
      status: 'active',
    };
  }
}
