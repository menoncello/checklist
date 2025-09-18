import { createLogger, type Logger } from '../utils/logger';
import { NavigationHelper } from './NavigationHelper';
import { WorkflowStateManager } from './StateManager';
import { WorkflowState, ChecklistTemplate, Step, StepResult } from './types';

export class WorkflowNavigator {
  private logger: Logger;
  private navigationHelper: NavigationHelper;
  private stateManager: WorkflowStateManager;

  constructor() {
    this.logger = createLogger('checklist:workflow:navigator');
    this.navigationHelper = new NavigationHelper();
    this.stateManager = new WorkflowStateManager();
  }

  async advance(
    state: WorkflowState,
    template: ChecklistTemplate
  ): Promise<{ newState: WorkflowState; result: StepResult }> {
    const currentStep = template.steps[state.currentStepIndex];
    if (currentStep === undefined) {
      return this.completeWorkflowResult(state, template);
    }

    const completedStep = this.navigationHelper.createCompletedStep(
      currentStep,
      state
    );
    const updatedState = this.stateManager.completeCurrentStep(
      state,
      completedStep,
      template
    );
    const nextState = await this.moveToNextStep(updatedState, template);
    const nextStep = this.getNextVisibleStep(nextState, template);

    this.navigationHelper.logAdvancement(state, nextState, nextStep);

    return {
      newState: nextState,
      result: {
        success: true,
        step: nextStep,
      },
    };
  }

  async skip(
    state: WorkflowState,
    template: ChecklistTemplate,
    reason: string = 'User skipped'
  ): Promise<{ newState: WorkflowState; result: StepResult }> {
    const currentStep = template.steps[state.currentStepIndex];
    if (currentStep === undefined) {
      return this.completeWorkflowResult(state, template);
    }

    const skippedStep = this.navigationHelper.createSkippedStep(
      currentStep,
      reason
    );
    const updatedState = this.stateManager.skipStep(state, skippedStep);
    const nextState = await this.moveToNextStep(updatedState, template);
    const _nextStep = this.getNextVisibleStep(nextState, template);

    this.navigationHelper.logSkip(currentStep, reason);

    return {
      newState: nextState,
      result: {
        success: true,
        step: currentStep,
      },
    };
  }

  async goBack(
    state: WorkflowState,
    template: ChecklistTemplate
  ): Promise<{ newState: WorkflowState; result: StepResult }> {
    const previousIndex = this.findPreviousStepIndex(state, template);

    if (previousIndex === -1) {
      return {
        newState: state,
        result: {
          success: false,
          step: null,
          error: 'No previous step available',
        },
      };
    }

    const newState = this.stateManager.moveToStep(state, previousIndex);
    const previousStep = template.steps[previousIndex];

    this.logger.info({
      msg: 'Moved back to previous step',
      step: previousStep?.id,
    });

    return {
      newState,
      result: {
        success: true,
        step: previousStep,
      },
    };
  }

  reset(template: ChecklistTemplate): WorkflowState {
    const newState = this.stateManager.resetWorkflow(template);
    this.logger.info({ msg: 'Workflow reset' });
    return newState;
  }

  private async moveToNextStep(
    state: WorkflowState,
    template: ChecklistTemplate
  ): Promise<WorkflowState> {
    const nextIndex = this.navigationHelper.findNextValidStepIndex(
      state.currentStepIndex,
      template.steps,
      state.variables
    );

    // Skip any steps that don't meet conditions
    let currentState = state;
    let currentIndex = state.currentStepIndex + 1;

    while (currentIndex < nextIndex && currentIndex < template.steps.length) {
      const step = template.steps[currentIndex];
      if (
        step != null &&
        !this.navigationHelper.shouldShowStep(step, state.variables)
      ) {
        const skippedStep = this.navigationHelper.createSkippedStep(
          step,
          'Condition not met'
        );
        currentState = this.stateManager.skipStep(currentState, skippedStep);
      }
      currentIndex++;
    }

    return this.stateManager.moveToStep(currentState, nextIndex);
  }

  private findPreviousStepIndex(
    state: WorkflowState,
    template: ChecklistTemplate
  ): number {
    for (let i = state.currentStepIndex - 1; i >= 0; i--) {
      const step = template.steps[i];
      if (
        step != null &&
        this.navigationHelper.shouldShowStep(step, state.variables)
      ) {
        return i;
      }
    }
    return -1;
  }

  private getNextVisibleStep(
    state: WorkflowState,
    template: ChecklistTemplate
  ): Step | null {
    if (state.currentStepIndex === -1) {
      return null; // Workflow completed
    }

    return template.steps[state.currentStepIndex] ?? null;
  }

  private completeWorkflowResult(
    state: WorkflowState,
    _template: ChecklistTemplate
  ): { newState: WorkflowState; result: StepResult } {
    const completedState = this.stateManager.completeWorkflow(state);
    this.navigationHelper.logCompletion(completedState);

    return {
      newState: completedState,
      result: {
        success: true,
        step: null,
      },
    };
  }
}
