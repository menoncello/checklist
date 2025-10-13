/**
 * Helper class for event emission in WorkflowEngine
 * Extracted to keep WorkflowEngine under 300 lines
 */

import type {
  ChecklistTemplate,
  Progress,
  StepResult,
  Summary,
  TypedEventEmitter,
  WorkflowEngineEvents,
  WorkflowState,
} from './types';

export class WorkflowEventHelper {
  constructor(
    private readonly emitter: TypedEventEmitter<WorkflowEngineEvents>,
    private readonly getState: () => WorkflowState,
    private readonly getTemplate: () => ChecklistTemplate
  ) {}

  /**
   * Emit step-related events
   */
  emitStepEvents(result: StepResult, eventType: string): void {
    const state = this.getState();
    this.emitter.emit(eventType, { step: result.step, state });

    if (eventType === 'stepCompleted' && result.step) {
      this.emitter.emit('step:completed', result.step);
    }
    if (result.step) {
      this.emitter.emit('step:changed', result.step);
    }

    this.emitter.emit('progress:updated', this.calculateProgress());
    this.emitWorkflowCompletedIfFinished();
  }

  /**
   * Calculate current progress
   */
  private calculateProgress(): Progress {
    const state = this.getState();
    const template = this.getTemplate();
    const total = template.steps.length;
    const completed = state.completedSteps.length;

    return {
      currentStepIndex: state.currentStepIndex,
      totalSteps: total,
      completedSteps: completed,
      skippedSteps: state.skippedSteps.length,
      percentComplete: total > 0 ? (completed / total) * 100 : 0,
    };
  }

  /**
   * Emit workflow completion events if finished
   */
  private emitWorkflowCompletedIfFinished(): void {
    const state = this.getState();
    if (state.status !== 'completed') return;

    const summary: Summary = this.createSummary();
    this.emitter.emit('workflowCompleted', summary);
    this.emitter.emit('workflow:completed', summary);
  }

  /**
   * Create workflow summary
   */
  private createSummary(): Summary {
    const state = this.getState();
    const template = this.getTemplate();

    return {
      templateId: template.id,
      instanceId: state.currentStep?.id ?? '',
      startedAt: state.startedAt ?? new Date(),
      completedAt: new Date(),
      duration: this.calculateDuration(),
      completedSteps: state.completedSteps.length,
      skippedSteps: state.skippedSteps.length,
      totalSteps: template.steps.length,
      status: 'completed',
    };
  }

  /**
   * Calculate workflow duration
   */
  private calculateDuration(): number {
    const state = this.getState();
    return state.startedAt != null ? Date.now() - state.startedAt.getTime() : 0;
  }
}
