import type { WorkflowDefinition } from '../interfaces/IWorkflowEngine';
import type { Logger } from '../utils/logger';
import { WorkflowValidator } from './WorkflowValidator';

/**
 * Handles workflow loading and registration
 */
export class WorkflowLoader {
  private workflows: Map<string, WorkflowDefinition> = new Map();

  constructor(private logger: Logger) {}

  /**
   * Load a workflow definition
   */
  async loadWorkflow(definition: WorkflowDefinition): Promise<void> {
    try {
      WorkflowValidator.validateWorkflowDefinition(definition);
      this.workflows.set(definition.id, definition);

      this.logger.info({
        msg: 'Workflow loaded',
        workflowId: definition.id,
        workflowName: definition.name,
      });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to load workflow',
        error: (error as Error).message,
        workflowId: definition.id,
      });
      throw error;
    }
  }

  /**
   * Get workflow by ID
   */
  getWorkflow(workflowId: string): WorkflowDefinition {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    return workflow;
  }

  /**
   * Check if workflow exists
   */
  hasWorkflow(workflowId: string): boolean {
    return this.workflows.has(workflowId);
  }

  /**
   * Get all workflows
   */
  getAllWorkflows(): Map<string, WorkflowDefinition> {
    return new Map(this.workflows);
  }

  /**
   * Clear all workflows
   */
  clearWorkflows(): void {
    this.workflows.clear();
  }
}
