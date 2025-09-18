import type { WorkflowEvent } from '../interfaces/IWorkflowEngine';
import { WorkflowEventManager } from './WorkflowEventManager';

/**
 * Helper for workflow event emissions
 */
export class WorkflowEventHelper {
  constructor(private eventManager: WorkflowEventManager) {}

  /**
   * Emit workflow started event
   */
  async emitWorkflowStarted(
    workflowId: string,
    instanceId: string
  ): Promise<void> {
    await this.eventManager.emit({
      type: 'workflow-started',
      workflowId,
      instanceId,
      timestamp: new Date(),
    });
  }

  /**
   * Emit workflow paused event
   */
  async emitWorkflowPaused(
    workflowId: string,
    instanceId: string
  ): Promise<void> {
    await this.eventManager.emit({
      type: 'workflow-paused',
      workflowId,
      instanceId,
      timestamp: new Date(),
    });
  }

  /**
   * Emit workflow failed event
   */
  async emitWorkflowFailed(
    workflowId: string,
    instanceId: string
  ): Promise<void> {
    await this.eventManager.emit({
      type: 'workflow-failed',
      workflowId,
      instanceId,
      timestamp: new Date(),
    });
  }

  /**
   * Emit custom event
   */
  async emit(event: WorkflowEvent): Promise<void> {
    await this.eventManager.emit(event);
  }
}
