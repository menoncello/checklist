import { createLogger, type Logger } from '../utils/logger';
import { safeEval } from './conditions';
import {
  WorkflowState,
  ChecklistTemplate,
  Step,
  StepResult,
  Summary,
  CompletedStep,
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
    const updatedState = this.completeCurrentStep(state, completedStep, template);
    const nextState = await this.moveToNextStep(updatedState, template);
    const nextStep = this.getNextVisibleStep(nextState, template);

    this.logAdvancement(state, nextState, nextStep);

    return {
      newState: nextState,
      result: {
        success: true,
        completed: nextStep === null,
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
    if (previousStep === undefined) {
      return this.createFailureResult(state, template);
    }

    const newState = this.createGoBackState(state, template, previousStep);
    const updatedState = this.updateProgress(newState, template);

    this.logGoBack(state, updatedState, previousStep);

    return {
      newState: updatedState,
      result: {
        success: true,
        completed: false,
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
        result: { success: false, completed: false, step: null },
      };
    }

    const skippedStep = this.createSkippedStep(currentStep, state, reason);
    const newState = this.createSkippedState(state, skippedStep);
    const updatedState = this.updateProgress(newState, template);
    const nextState = await this.moveToNextStep(updatedState, template);

    this.logSkip(state, currentStep, reason);

    return {
      newState: nextState,
      result: {
        success: true,
        completed: this.getNextVisibleStep(nextState, template) === null,
        step: this.getNextVisibleStep(nextState, template),
      },
    };
  }

  getNextVisibleStep(state: WorkflowState, template: ChecklistTemplate): Step | null {
    const visibleSteps = this.getVisibleSteps(state, template);
    const currentIndex = visibleSteps.findIndex(
      (step) => template.steps.indexOf(step) >= state.currentStepIndex
    );

    return currentIndex >= 0 ? visibleSteps[currentIndex] : null;
  }

  getPreviousVisibleStep(state: WorkflowState, template: ChecklistTemplate): Step | null {
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
      result: { success: true, completed: true, step: null },
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
        completed: false,
        step: template.steps[state.currentStepIndex] ?? null,
      },
    };
  }

  private createGoBackState(
    state: WorkflowState,
    template: ChecklistTemplate,
    previousStep: Step
  ): WorkflowState {
    return {
      ...state,
      currentStepIndex: template.steps.indexOf(previousStep),
      status: 'active' as const,
      completedSteps: state.completedSteps.filter(
        (step) => step.stepIndex < template.steps.indexOf(previousStep)
      ),
    };
  }

  private createSkippedState(state: WorkflowState, skippedStep: CompletedStep): WorkflowState {
    return {
      ...state,
      completedSteps: [...state.completedSteps, skippedStep],
      currentStepIndex: state.currentStepIndex + 1,
    };
  }

  private getVisibleSteps(state: WorkflowState, template: ChecklistTemplate): Step[] {
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

  private buildContext(state: WorkflowState, _template: ChecklistTemplate): Record<string, unknown> {
    return {
      vars: state.variables,
      completedSteps: state.completedSteps.map(step => step.stepId),
      currentStepIndex: state.currentStepIndex,
      progress: state.progress,
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
    const nextStep = this.getNextVisibleStep({ ...state, currentStepIndex: nextIndex }, template);

    if (nextStep === undefined) {
      return this.completeWorkflow(state, template);
    }

    return {
      ...state,
      currentStepIndex: template.steps.indexOf(nextStep),
      status: 'active',
    };
  }

  private completeWorkflow(state: WorkflowState, template: ChecklistTemplate): WorkflowState {
    return {
      ...state,
      status: 'completed',
      currentStepIndex: template.steps.length,
      progress: {
        ...state.progress,
        percentage: 100,
      },
      summary: this.generateSummary(state, template),
    };
  }

  private createCompletedStep(step: Step, state: WorkflowState): CompletedStep {
    return {
      stepId: step.id,
      stepIndex: state.currentStepIndex,
      title: step.title,
      completedAt: new Date().toISOString(),
      skipped: false,
    };
  }

  private createSkippedStep(step: Step, state: WorkflowState, reason?: string): CompletedStep {
    return {
      stepId: step.id,
      stepIndex: state.currentStepIndex,
      title: step.title,
      completedAt: new Date().toISOString(),
      skipped: true,
      skipReason: reason,
    };
  }

  private updateProgress(state: WorkflowState, template: ChecklistTemplate): WorkflowState {
    const completedCount = state.completedSteps.filter(step => step.skipped !== true).length;
    const totalSteps = template.steps.length;
    const percentage = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

    return {
      ...state,
      progress: {
        totalSteps,
        completedSteps: completedCount,
        percentage,
      },
    };
  }

  private generateSummary(state: WorkflowState, template: ChecklistTemplate): Summary {
    const completedSteps = state.completedSteps.filter(step => step.skipped !== true).length;
    const skippedSteps = state.completedSteps.filter(step => step.skipped === true).length;
    const totalSteps = template.steps.length;

    return {
      totalSteps,
      completedSteps,
      skippedSteps,
      completionRate: totalSteps > 0 ? completedSteps / totalSteps : 0,
      estimatedTimeRemaining: 0, // Could be calculated based on step times
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

  private logSkip(state: WorkflowState, currentStep: Step, reason?: string): void {
    this.logger.info({
      msg: 'Skipped step',
      stepIndex: state.currentStepIndex,
      stepTitle: currentStep.title,
      reason: reason ?? 'No reason provided',
    });
  }
}