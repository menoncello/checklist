import { createLogger, type Logger } from '../utils/logger';
import { safeEval } from './conditions';
import {
  WorkflowState,
  ChecklistTemplate,
  Step,
  StepResult,
  Summary,
  CompletedStep,
  SkippedStep,
} from './types';

export class WorkflowNavigator {
  private logger: Logger;

  constructor() {
    this.logger = createLogger('checklist:workflow:navigator');
  }

  async advance(
    state: WorkflowState,
    template: ChecklistTemplate
  ): Promise<{ newState: WorkflowState; result: StepResult }> {
    const currentStep = template.steps[state.currentStepIndex];
    if (currentStep === undefined) {
      return this.completeWorkflowResult(state, template);
    }

    const completedStep = this.createCompletedStep(currentStep, state);
    const updatedState = this.completeCurrentStep(
      state,
      completedStep,
      template
    );
    const nextState = await this.moveToNextStep(updatedState, template);
    const nextStep = this.getNextVisibleStep(nextState, template);

    this.logAdvancement(state, nextState, nextStep);

    // Check if workflow completed during the move
    const _isCompleted = nextState.status === 'completed';

    return {
      newState: nextState,
      result: {
        success: true,
        step: nextStep,
      },
    };
  }

  async goBack(
    state: WorkflowState,
    template: ChecklistTemplate
  ): Promise<{ newState: WorkflowState; result: StepResult }> {
    if (state.currentStepIndex <= 0) {
      return this.createFailureResult(state, template);
    }

    const previousStep = this.getPreviousVisibleStep(state, template);
    if (previousStep === null) {
      return this.createFailureResult(state, template);
    }

    const newState = this.createGoBackState(state, template, previousStep);
    const updatedState = this.updateProgress(newState, template);

    this.logGoBack(state, updatedState, previousStep);

    return {
      newState: updatedState,
      result: {
        success: true,
        step: previousStep,
      },
    };
  }

  async skip(
    state: WorkflowState,
    template: ChecklistTemplate,
    reason?: string
  ): Promise<{ newState: WorkflowState; result: StepResult }> {
    const currentStep = template.steps[state.currentStepIndex];
    if (currentStep === undefined) {
      return {
        newState: state,
        result: { success: false, step: null },
      };
    }

    const skippedStep = this.createSkippedStep(currentStep, state, reason);
    const newState = this.createSkippedState(state, skippedStep);
    const updatedState = this.updateProgress(newState, template);

    // Check if workflow completed after skipping
    const nextStep = this.getNextVisibleStep(updatedState, template);
    const nextState =
      nextStep === null
        ? this.completeWorkflow(updatedState, template)
        : updatedState;

    this.logSkip(state, currentStep, reason);

    return {
      newState: nextState,
      result: {
        success: true,
        step: currentStep,
      },
    };
  }

  getNextVisibleStep(
    state: WorkflowState,
    template: ChecklistTemplate
  ): Step | null {
    const visibleSteps = this.getVisibleSteps(state, template);
    const currentIndex = visibleSteps.findIndex(
      (step) => template.steps.indexOf(step) >= state.currentStepIndex
    );

    return currentIndex >= 0 ? visibleSteps[currentIndex] : null;
  }

  getPreviousVisibleStep(
    state: WorkflowState,
    template: ChecklistTemplate
  ): Step | null {
    const visibleSteps = this.getVisibleSteps(state, template);
    const currentIndex = visibleSteps.findIndex(
      (step) => template.steps.indexOf(step) === state.currentStepIndex
    );

    return currentIndex > 0 ? visibleSteps[currentIndex - 1] : null;
  }

  private completeWorkflowResult(
    state: WorkflowState,
    template: ChecklistTemplate
  ): { newState: WorkflowState; result: StepResult } {
    return {
      newState: this.completeWorkflow(state, template),
      result: { success: true, step: null },
    };
  }

  private createFailureResult(
    state: WorkflowState,
    template: ChecklistTemplate
  ): { newState: WorkflowState; result: StepResult } {
    return {
      newState: state,
      result: {
        success: false,
        step: template.steps[state.currentStepIndex] ?? null,
      },
    };
  }

  private createGoBackState(
    state: WorkflowState,
    template: ChecklistTemplate,
    previousStep: Step
  ): WorkflowState {
    const previousStepIndex = template.steps.indexOf(previousStep);
    return {
      ...state,
      currentStepIndex: previousStepIndex,
      status: 'active' as const,
      completedSteps: state.completedSteps.filter((completedStep) => {
        const stepIndex = template.steps.findIndex(
          (s) => s.id === completedStep.step.id
        );
        return stepIndex < previousStepIndex;
      }),
    };
  }

  private createSkippedState(
    state: WorkflowState,
    skippedStep: SkippedStep
  ): WorkflowState {
    return {
      ...state,
      skippedSteps: [...state.skippedSteps, skippedStep],
      currentStepIndex: state.currentStepIndex + 1,
    };
  }

  private getVisibleSteps(
    state: WorkflowState,
    template: ChecklistTemplate
  ): Step[] {
    return template.steps.filter((step) => {
      if (step.condition === undefined) return true;
      return this.evaluateCondition(step.condition, state, template);
    });
  }

  private evaluateCondition(
    condition: string,
    state: WorkflowState,
    template: ChecklistTemplate
  ): boolean {
    try {
      const context = this.buildContext(state, template);
      return safeEval(condition, context);
    } catch (error) {
      this.logger.error({
        msg: 'Condition evaluation failed',
        condition,
        error: (error as Error).message,
      });
      return false;
    }
  }

  private buildContext(
    state: WorkflowState,
    _template: ChecklistTemplate
  ): Record<string, unknown> {
    return {
      ...state.variables,
      vars: state.variables,
      completedSteps: state.completedSteps.map((step) => step.step.id),
      currentStepIndex: state.currentStepIndex,
    };
  }

  private completeCurrentStep(
    state: WorkflowState,
    completedStep: CompletedStep,
    template: ChecklistTemplate
  ): WorkflowState {
    const newState = {
      ...state,
      completedSteps: [...state.completedSteps, completedStep],
    };

    return this.updateProgress(newState, template);
  }

  private async moveToNextStep(
    state: WorkflowState,
    template: ChecklistTemplate
  ): Promise<WorkflowState> {
    const nextIndex = state.currentStepIndex + 1;
    const nextStep = this.getNextVisibleStep(
      { ...state, currentStepIndex: nextIndex },
      template
    );

    if (nextStep === null) {
      return this.completeWorkflow(state, template);
    }

    return {
      ...state,
      currentStepIndex: template.steps.indexOf(nextStep),
      status: 'active',
    };
  }

  private completeWorkflow(
    state: WorkflowState,
    template: ChecklistTemplate
  ): WorkflowState {
    const _summary = this.generateSummary(state, template);
    return {
      ...state,
      status: 'completed',
      currentStepIndex: template.steps.length,
      completedAt: new Date(),
    };
  }

  private createCompletedStep(
    step: Step,
    _state: WorkflowState
  ): CompletedStep {
    return {
      step: step,
      completedAt: new Date(),
    };
  }

  private createSkippedStep(
    step: Step,
    _state: WorkflowState,
    reason?: string
  ): SkippedStep {
    return {
      step: step,
      timestamp: new Date(),
      reason: reason,
    };
  }

  private updateProgress(
    state: WorkflowState,
    _template: ChecklistTemplate
  ): WorkflowState {
    return state;
  }

  private generateSummary(
    state: WorkflowState,
    template: ChecklistTemplate
  ): Summary {
    const completedSteps = state.completedSteps.length;
    const skippedSteps = state.skippedSteps.length;
    const totalSteps = template.steps.length;

    return {
      templateId:
        state.templateId != null && state.templateId !== ''
          ? state.templateId
          : '',
      instanceId:
        state.instanceId != null && state.instanceId !== ''
          ? state.instanceId
          : '',
      startedAt: state.startedAt ?? new Date(),
      completedAt: state.completedAt ?? new Date(),
      duration: 0,
      totalSteps,
      completedSteps,
      skippedSteps,
      status: 'completed',
    };
  }

  private logAdvancement(
    fromState: WorkflowState,
    toState: WorkflowState,
    nextStep: Step | null
  ): void {
    this.logger.info({
      msg: 'Advanced to next step',
      fromStep: fromState.currentStepIndex,
      toStep: toState.currentStepIndex,
      nextStepTitle: nextStep?.title,
    });
  }

  private logGoBack(
    fromState: WorkflowState,
    toState: WorkflowState,
    previousStep: Step
  ): void {
    this.logger.info({
      msg: 'Moved back to previous step',
      fromStep: fromState.currentStepIndex,
      toStep: toState.currentStepIndex,
      stepTitle: previousStep.title,
    });
  }

  private logSkip(
    state: WorkflowState,
    currentStep: Step,
    reason?: string
  ): void {
    this.logger.info({
      msg: 'Skipped step',
      stepIndex: state.currentStepIndex,
      stepTitle: currentStep.title,
      reason: reason ?? 'No reason provided',
    });
  }
}
