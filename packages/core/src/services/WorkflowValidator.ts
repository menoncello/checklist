import type { WorkflowInstance } from '../interfaces/IStateManager';
import type { WorkflowDefinition, WorkflowStep } from '../interfaces/IWorkflowEngine';

export class WorkflowValidator {
  static validateWorkflowDefinition(definition: WorkflowDefinition): void {
    if (
      !definition.id ||
      !definition.name ||
      !Array.isArray(definition.steps) ||
      definition.steps.length === 0
    ) {
      throw new Error('Invalid workflow definition');
    }

    const stepIds = new Set<string>();
    for (const step of definition.steps) {
      if (!step.id || !step.name || !step.type) {
        throw new Error(`Invalid step in workflow: ${JSON.stringify(step)}`);
      }
      if (stepIds.has(step.id)) {
        throw new Error(`Duplicate step ID: ${step.id}`);
      }
      stepIds.add(step.id);
    }
  }

  static validateActiveWorkflow(
    currentInstance: WorkflowInstance | null,
    currentWorkflow: WorkflowDefinition | null
  ): void {
    if (!currentInstance || !currentWorkflow) {
      throw new Error('No active workflow');
    }
  }

  static validateRunningStatus(status: string): void {
    if (status !== 'running') {
      throw new Error('Workflow is not running');
    }
  }

  static validatePausedStatus(status: string): void {
    if (status !== 'paused') {
      throw new Error('Workflow is not paused');
    }
  }

  static findCurrentStep(
    currentInstance: WorkflowInstance | null,
    currentWorkflow: WorkflowDefinition | null
  ): WorkflowStep | null {
    if (!currentInstance || !currentWorkflow) {
      return null;
    }

    return (
      currentWorkflow.steps.find(
        (step) => step.id === currentInstance.currentStepId
      ) ?? null
    );
  }

  static findStepById(workflow: WorkflowDefinition, stepId: string): WorkflowStep | null {
    return workflow.steps.find((step) => step.id === stepId) ?? null;
  }

  static findPreviousStep(
    currentWorkflow: WorkflowDefinition,
    currentStepId: string
  ): WorkflowStep {
    const currentStepIndex = currentWorkflow.steps.findIndex(
      (step) => step.id === currentStepId
    );

    if (currentStepIndex <= 0) {
      throw new Error('Cannot go back from first step');
    }

    return currentWorkflow.steps[currentStepIndex - 1];
  }

  static findNextStepId(
    currentWorkflow: WorkflowDefinition,
    currentStep: WorkflowStep
  ): string | null {
    // If step has explicit next
    if (currentStep.next !== undefined && currentStep.next !== null) {
      if (typeof currentStep.next === 'string' && currentStep.next !== '') {
        return currentStep.next;
      }
      // For parallel/conditional, return first valid next
      if (Array.isArray(currentStep.next)) {
        return currentStep.next[0] ?? null;
      }
    }

    // Otherwise, find next step in sequence
    const currentIndex = currentWorkflow.steps.findIndex(
      (s) => s.id === currentStep.id
    );
    if (
      currentIndex >= 0 &&
      currentIndex < currentWorkflow.steps.length - 1
    ) {
      return currentWorkflow.steps[currentIndex + 1].id;
    }

    return null;
  }
}