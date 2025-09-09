import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import type { WorkflowInstance } from '../interfaces/IStateManager';
import type { IStateManager } from '../interfaces/IStateManager';
import type {
  IWorkflowEngine,
  WorkflowDefinition,
  WorkflowStep,
  WorkflowEvent,
  WorkflowEventHandler,
} from '../interfaces/IWorkflowEngine';
import type { Logger } from '../utils/logger';
import { BaseService, ServiceConfig } from './BaseService';

export interface WorkflowEngineConfig extends ServiceConfig {
  maxStepRetries?: number;
  stepTimeout?: number;
  enableEventLogging?: boolean;
}

export class WorkflowEngineService
  extends BaseService
  implements IWorkflowEngine
{
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private currentInstance: WorkflowInstance | null = null;
  private currentWorkflow: WorkflowDefinition | null = null;
  private eventEmitter: EventEmitter = new EventEmitter();
  private stateManager: IStateManager;
  private status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' =
    'idle';

  constructor(
    config: WorkflowEngineConfig,
    logger: Logger,
    stateManager: IStateManager
  ) {
    super(config, logger);
    this.stateManager = stateManager;
  }

  async loadWorkflow(definition: WorkflowDefinition): Promise<void> {
    try {
      this.validateWorkflowDefinition(definition);
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

  async startWorkflow(workflowId: string): Promise<WorkflowInstance> {
    try {
      const workflow = this.workflows.get(workflowId);
      if (!workflow) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }

      if (this.currentInstance && this.currentInstance.status === 'active') {
        throw new Error('Another workflow is already running');
      }

      const instance: WorkflowInstance = {
        id: randomUUID(),
        workflowId,
        currentStepId: workflow.steps[0]?.id ?? '',
        startedAt: new Date(),
        updatedAt: new Date(),
        status: 'active',
        stepStates: {},
      };

      // Initialize step states
      for (const step of workflow.steps) {
        instance.stepStates[step.id] = {
          stepId: step.id,
          status: 'pending',
        };
      }

      this.currentInstance = instance;
      this.currentWorkflow = workflow;
      this.status = 'running';

      // Save to state manager
      const state = await this.stateManager.load();
      state.activeInstance = instance;
      state.instances.push(instance);
      await this.stateManager.save(state);

      await this.emit({
        type: 'workflow-started',
        workflowId,
        instanceId: instance.id,
        timestamp: new Date(),
      });

      this.logger.info({
        msg: 'Workflow started',
        workflowId,
        instanceId: instance.id,
      });

      return instance;
    } catch (error) {
      this.logger.error({
        msg: 'Failed to start workflow',
        error: (error as Error).message,
        workflowId,
      });
      throw error;
    }
  }

  getCurrentStep(): WorkflowStep | null {
    if (!this.currentInstance || !this.currentWorkflow) {
      return null;
    }

    return (
      this.currentWorkflow.steps.find(
        (step) =>
          this.currentInstance !== null &&
          step.id === this.currentInstance.currentStepId
      ) ?? null
    );
  }

  async advance(): Promise<void> {
    try {
      if (!this.currentInstance || !this.currentWorkflow) {
        throw new Error('No active workflow');
      }

      const currentStep = this.getCurrentStep();
      if (!currentStep) {
        throw new Error('Current step not found');
      }

      // Mark current step as completed
      this.currentInstance.stepStates[currentStep.id] = {
        ...this.currentInstance.stepStates[currentStep.id],
        status: 'completed',
        completedAt: new Date(),
      };

      await this.emit({
        type: 'step-completed',
        workflowId: this.currentWorkflow.id,
        instanceId: this.currentInstance.id,
        stepId: currentStep.id,
        timestamp: new Date(),
      });

      // Find next step
      const nextStepId = this.findNextStep(currentStep);

      if (
        nextStepId !== null &&
        nextStepId !== undefined &&
        nextStepId !== ''
      ) {
        this.currentInstance.currentStepId = nextStepId;
        this.currentInstance.updatedAt = new Date();

        await this.emit({
          type: 'step-started',
          workflowId: this.currentWorkflow.id,
          instanceId: this.currentInstance.id,
          stepId: nextStepId,
          timestamp: new Date(),
        });
      } else {
        // Workflow completed
        this.currentInstance.status = 'completed';
        this.currentInstance.completedAt = new Date();
        this.status = 'completed';

        await this.emit({
          type: 'workflow-completed',
          workflowId: this.currentWorkflow.id,
          instanceId: this.currentInstance.id,
          timestamp: new Date(),
        });
      }

      // Save state
      const state = await this.stateManager.load();
      state.activeInstance = this.currentInstance;
      const instanceIndex = state.instances.findIndex(
        (i) => i.id === this.currentInstance?.id
      );
      if (instanceIndex >= 0) {
        state.instances[instanceIndex] = this.currentInstance;
      }
      await this.stateManager.save(state);

      this.logger.debug({
        msg: 'Workflow advanced',
        currentStepId: this.currentInstance.currentStepId,
        status: this.currentInstance.status,
      });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to advance workflow',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async goBack(): Promise<void> {
    try {
      if (!this.currentInstance || !this.currentWorkflow) {
        throw new Error('No active workflow');
      }

      const currentStepIndex = this.currentWorkflow.steps.findIndex(
        (step) => step.id === this.currentInstance?.currentStepId
      );

      if (currentStepIndex <= 0) {
        throw new Error('Cannot go back from first step');
      }

      const previousStep = this.currentWorkflow.steps[currentStepIndex - 1];
      this.currentInstance.currentStepId = previousStep.id;
      this.currentInstance.updatedAt = new Date();

      // Reset step state
      this.currentInstance.stepStates[previousStep.id] = {
        stepId: previousStep.id,
        status: 'pending',
      };

      // Save state
      const state = await this.stateManager.load();
      state.activeInstance = this.currentInstance;
      const instanceIndex = state.instances.findIndex(
        (i) => i.id === this.currentInstance?.id
      );
      if (instanceIndex >= 0) {
        state.instances[instanceIndex] = this.currentInstance;
      }
      await this.stateManager.save(state);

      this.logger.debug({
        msg: 'Workflow moved back',
        currentStepId: this.currentInstance.currentStepId,
      });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to go back in workflow',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async skip(): Promise<void> {
    try {
      if (!this.currentInstance || !this.currentWorkflow) {
        throw new Error('No active workflow');
      }

      const currentStep = this.getCurrentStep();
      if (!currentStep) {
        throw new Error('Current step not found');
      }

      // Mark current step as skipped
      this.currentInstance.stepStates[currentStep.id] = {
        ...this.currentInstance.stepStates[currentStep.id],
        status: 'skipped',
        completedAt: new Date(),
      };

      await this.emit({
        type: 'step-skipped',
        workflowId: this.currentWorkflow.id,
        instanceId: this.currentInstance.id,
        stepId: currentStep.id,
        timestamp: new Date(),
      });

      // Advance to next step
      await this.advance();

      this.logger.debug({
        msg: 'Step skipped',
        stepId: currentStep.id,
      });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to skip step',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async reset(): Promise<void> {
    try {
      if (this.currentInstance && this.currentWorkflow) {
        await this.emit({
          type: 'workflow-failed',
          workflowId: this.currentWorkflow.id,
          instanceId: this.currentInstance.id,
          timestamp: new Date(),
        });
      }

      this.currentInstance = null;
      this.currentWorkflow = null;
      this.status = 'idle';

      // Clear active instance in state
      const state = await this.stateManager.load();
      state.activeInstance = undefined;
      await this.stateManager.save(state);

      this.logger.info({ msg: 'Workflow engine reset' });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to reset workflow',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async pause(): Promise<void> {
    if (this.status !== 'running') {
      throw new Error('Workflow is not running');
    }

    this.status = 'paused';

    if (this.currentInstance) {
      this.currentInstance.status = 'paused';

      await this.emit({
        type: 'workflow-paused',
        workflowId: this.currentWorkflow?.id ?? '',
        instanceId: this.currentInstance.id,
        timestamp: new Date(),
      });

      // Save state
      const state = await this.stateManager.load();
      state.activeInstance = this.currentInstance;
      await this.stateManager.save(state);
    }

    this.logger.info({ msg: 'Workflow paused' });
  }

  async resume(): Promise<void> {
    if (this.status !== 'paused') {
      throw new Error('Workflow is not paused');
    }

    this.status = 'running';

    if (this.currentInstance) {
      this.currentInstance.status = 'active';

      // Save state
      const state = await this.stateManager.load();
      state.activeInstance = this.currentInstance;
      await this.stateManager.save(state);
    }

    this.logger.info({ msg: 'Workflow resumed' });
  }

  getStatus(): 'idle' | 'running' | 'paused' | 'completed' | 'failed' {
    return this.status;
  }

  getInstance(): WorkflowInstance | null {
    return this.currentInstance;
  }

  on(event: WorkflowEvent['type'], handler: WorkflowEventHandler): void {
    this.eventEmitter.on(event, handler);
  }

  off(event: WorkflowEvent['type'], handler: WorkflowEventHandler): void {
    this.eventEmitter.off(event, handler);
  }

  async emit(event: WorkflowEvent): Promise<void> {
    if ((this.config as WorkflowEngineConfig).enableEventLogging === true) {
      this.logger.debug({
        msg: 'Workflow event',
        event,
      });
    }

    this.eventEmitter.emit(event.type, event);
  }

  protected async onInitialize(): Promise<void> {
    // Load any persisted active instance
    try {
      const state = await this.stateManager.load();
      if (state.activeInstance && state.activeInstance.status === 'active') {
        this.currentInstance = state.activeInstance;
        const workflow = this.workflows.get(state.activeInstance.workflowId);
        if (workflow) {
          this.currentWorkflow = workflow;
          this.status = 'running';

          this.logger.info({
            msg: 'Restored active workflow instance',
            instanceId: state.activeInstance.id,
            workflowId: state.activeInstance.workflowId,
          });
        }
      }
    } catch (error) {
      this.logger.warn({
        msg: 'Could not restore active workflow',
        error: (error as Error).message,
      });
    }
  }

  protected async onShutdown(): Promise<void> {
    if (this.status === 'running') {
      await this.pause();
    }
    this.eventEmitter.removeAllListeners();
  }

  private validateWorkflowDefinition(definition: WorkflowDefinition): void {
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

  private findNextStep(currentStep: WorkflowStep): string | null {
    if (!this.currentWorkflow) {
      return null;
    }

    // If step has explicit next
    if (currentStep.next !== undefined && currentStep.next !== null) {
      if (typeof currentStep.next === 'string' && currentStep.next !== '') {
        return currentStep.next;
      }
      // For parallel/conditional, return first valid next
      return currentStep.next[0] ?? null;
    }

    // Otherwise, find next step in sequence
    const currentIndex = this.currentWorkflow.steps.findIndex(
      (s) => s.id === currentStep.id
    );
    if (
      currentIndex >= 0 &&
      currentIndex < this.currentWorkflow.steps.length - 1
    ) {
      return this.currentWorkflow.steps[currentIndex + 1].id;
    }

    return null;
  }
}
