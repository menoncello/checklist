import type { WorkflowInstance } from '../interfaces/IStateManager';
import type {
  WorkflowDefinition,
  WorkflowStep,
  WorkflowEvent,
} from '../interfaces/IWorkflowEngine';
import type { Logger } from '../utils/logger';
import { WorkflowStateHelper } from './WorkflowStateHelper';
import { WorkflowValidator } from './WorkflowValidator';

export class WorkflowStepManager {
  constructor(
    private stateHelper: WorkflowStateHelper,
    private logger: Logger,
    private emitEvent: (event: WorkflowEvent) => Promise<void>
  ) {}

  async completeCurrentStep(
    currentStep: WorkflowStep,
    currentInstance: WorkflowInstance | null,
    currentWorkflow: WorkflowDefinition | null
  ): Promise<void> {
    if (!currentInstance || !currentWorkflow) {
      throw new Error('No active workflow');
    }

    this.stateHelper.updateStepState(
      currentInstance,
      currentStep.id,
      'completed',
      new Date()
    );

    await this.emitEvent({
      type: 'step-completed',
      workflowId: currentWorkflow.id,
      instanceId: currentInstance.id,
      stepId: currentStep.id,
      timestamp: new Date(),
    });
  }

  async moveToNextStep(
    nextStepId: string,
    currentInstance: WorkflowInstance | null,
    currentWorkflow: WorkflowDefinition | null
  ): Promise<void> {
    if (!currentInstance || !currentWorkflow) {
      throw new Error('No active workflow');
    }

    currentInstance.currentStepId = nextStepId;
    currentInstance.updatedAt = new Date();

    await this.emitEvent({
      type: 'step-started',
      workflowId: currentWorkflow.id,
      instanceId: currentInstance.id,
      stepId: nextStepId,
      timestamp: new Date(),
    });
  }

  async completeWorkflow(
    currentInstance: WorkflowInstance | null,
    currentWorkflow: WorkflowDefinition | null
  ): Promise<'completed'> {
    if (!currentInstance || !currentWorkflow) {
      throw new Error('No active workflow');
    }

    currentInstance.status = 'completed';
    currentInstance.completedAt = new Date();

    await this.emitEvent({
      type: 'workflow-completed',
      workflowId: currentWorkflow.id,
      instanceId: currentInstance.id,
      timestamp: new Date(),
    });

    return 'completed';
  }

  findNextStep(
    currentStep: WorkflowStep,
    currentWorkflow: WorkflowDefinition | null
  ): string | null {
    if (!currentWorkflow) {
      return null;
    }

    return WorkflowValidator.findNextStepId(currentWorkflow, currentStep);
  }

  findPreviousStep(
    currentWorkflow: WorkflowDefinition | null,
    currentInstance: WorkflowInstance | null
  ): WorkflowStep {
    if (!currentWorkflow || !currentInstance) {
      throw new Error('No active workflow');
    }
    return WorkflowValidator.findPreviousStep(
      currentWorkflow,
      currentInstance.currentStepId
    );
  }

  moveToPreviousStep(
    previousStep: WorkflowStep,
    currentInstance: WorkflowInstance | null
  ): void {
    if (!currentInstance) {
      throw new Error('No active workflow instance');
    }
    currentInstance.currentStepId = previousStep.id;
    currentInstance.updatedAt = new Date();
    this.stateHelper.updateStepState(
      currentInstance,
      previousStep.id,
      'pending'
    );
  }

  async markStepAsSkipped(
    currentStep: WorkflowStep,
    currentInstance: WorkflowInstance | null,
    currentWorkflow: WorkflowDefinition | null
  ): Promise<void> {
    if (!currentInstance || !currentWorkflow) {
      throw new Error('No active workflow');
    }
    this.stateHelper.updateStepState(
      currentInstance,
      currentStep.id,
      'skipped',
      new Date()
    );

    await this.emitEvent({
      type: 'step-skipped',
      workflowId: currentWorkflow.id,
      instanceId: currentInstance.id,
      stepId: currentStep.id,
      timestamp: new Date(),
    });
  }
}
