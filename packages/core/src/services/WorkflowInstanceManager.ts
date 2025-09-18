import { randomUUID } from 'crypto';
import type { WorkflowInstance } from '../interfaces/IStateManager';
import type { WorkflowDefinition } from '../interfaces/IWorkflowEngine';
import type { Logger } from '../utils/logger';

/**
 * Manages workflow instances lifecycle
 */
export class WorkflowInstanceManager {
  constructor(private logger: Logger) {}

  /**
   * Create a new workflow instance
   */
  createInstance(
    workflowId: string,
    workflow: WorkflowDefinition
  ): WorkflowInstance {
    const instance: WorkflowInstance = {
      id: randomUUID(),
      workflowId,
      currentStepId: workflow.steps[0]?.id ?? '',
      startedAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      stepStates: {},
    };

    this.logger.debug({
      msg: 'Workflow instance created',
      instanceId: instance.id,
      workflowId,
    });

    return instance;
  }

  /**
   * Check if there's an active workflow
   */
  checkForActiveWorkflow(currentInstance: WorkflowInstance | null): void {
    if (currentInstance && currentInstance.status === 'active') {
      throw new Error('Another workflow is already running');
    }
  }

  /**
   * Log workflow start
   */
  logWorkflowStart(workflowId: string, instanceId: string): void {
    this.logger.info({
      msg: 'Workflow started',
      workflowId,
      instanceId,
    });
  }

  /**
   * Log workflow advancement
   */
  logAdvancement(instance: WorkflowInstance | null): void {
    if (instance) {
      this.logger.debug({
        msg: 'Workflow advanced',
        currentStepId: instance.currentStepId,
        status: instance.status,
      });
    }
  }

  /**
   * Log workflow go back
   */
  logGoBack(instance: WorkflowInstance | null): void {
    if (instance) {
      this.logger.debug({
        msg: 'Workflow moved back',
        currentStepId: instance.currentStepId,
      });
    }
  }

  /**
   * Log skip action
   */
  logSkip(stepId: string): void {
    this.logger.debug({
      msg: 'Step skipped',
      stepId,
    });
  }

  /**
   * Log workflow pause
   */
  logPause(): void {
    this.logger.info({ msg: 'Workflow paused' });
  }

  /**
   * Log workflow resume
   */
  logResume(): void {
    this.logger.info({ msg: 'Workflow resumed' });
  }

  /**
   * Log workflow reset
   */
  logReset(): void {
    this.logger.info({ msg: 'Workflow engine reset' });
  }

  /**
   * Log workflow restoration
   */
  logRestoration(instanceId: string, workflowId: string): void {
    this.logger.info({
      msg: 'Restored active workflow instance',
      instanceId,
      workflowId,
    });
  }
}
