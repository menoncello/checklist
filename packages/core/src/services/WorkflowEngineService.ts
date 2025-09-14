import { randomUUID } from 'crypto';
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
import { WorkflowEventManager } from './WorkflowEventManager';
import { WorkflowStateHelper } from './WorkflowStateHelper';
import { WorkflowStepManager } from './WorkflowStepManager';
import { WorkflowValidator } from './WorkflowValidator';

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
  private stateManager: IStateManager;
  private stateHelper: WorkflowStateHelper;
  private eventManager: WorkflowEventManager;
  private stepManager: WorkflowStepManager;
  private status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' =
    'idle';

  constructor(
    config: WorkflowEngineConfig,
    logger: Logger,
    stateManager: IStateManager
  ) {
    super(config, logger);
    this.stateManager = stateManager;
    this.stateHelper = new WorkflowStateHelper(stateManager, logger);
    this.eventManager = new WorkflowEventManager(
      logger,
      config.enableEventLogging ?? false
    );
    this.stepManager = new WorkflowStepManager(
      this.stateHelper,
      logger,
      this.eventManager.emit.bind(this.eventManager)
    );
  }

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

  async startWorkflow(workflowId: string): Promise<WorkflowInstance> {
    try {
      const workflow = this.validateAndGetWorkflow(workflowId);
      this.checkForActiveWorkflow();

      const instance = this.createWorkflowInstance(workflowId, workflow);
      this.stateHelper.initializeStepStates(instance, workflow.steps);

      this.setActiveWorkflow(instance, workflow);
      await this.stateHelper.persistWorkflowStart(instance);
      await this.emitWorkflowStarted(workflowId, instance.id);

      this.logWorkflowStart(workflowId, instance.id);
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
    return WorkflowValidator.findCurrentStep(this.currentInstance, this.currentWorkflow);
  }

  async advance(): Promise<void> {
    try {
      const { currentStep } = this.validateActiveWorkflow();
      await this.stepManager.completeCurrentStep(
        currentStep,
        this.currentInstance,
        this.currentWorkflow
      );

      const nextStepId = this.stepManager.findNextStep(currentStep, this.currentWorkflow);
      await this.handleStepTransition(nextStepId);

      await this.stateHelper.saveWorkflowState(this.currentInstance);
      this.logAdvancement();
    } catch (error) {
      this.logger.error({
        msg: 'Failed to advance workflow',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async handleStepTransition(nextStepId: string | null | undefined): Promise<void> {
    if (nextStepId !== null && nextStepId !== undefined && nextStepId !== '') {
      await this.stepManager.moveToNextStep(
        nextStepId,
        this.currentInstance,
        this.currentWorkflow
      );
    } else {
      this.status = await this.stepManager.completeWorkflow(
        this.currentInstance,
        this.currentWorkflow
      );
    }
  }

  async goBack(): Promise<void> {
    try {
      this.validateActiveWorkflow();

      const previousStep = this.stepManager.findPreviousStep(
        this.currentWorkflow,
        this.currentInstance
      );
      this.stepManager.moveToPreviousStep(previousStep, this.currentInstance);

      await this.stateHelper.saveWorkflowState(this.currentInstance);
      this.logGoBack();
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
      const { currentStep } = this.validateActiveWorkflow();

      await this.stepManager.markStepAsSkipped(
        currentStep,
        this.currentInstance,
        this.currentWorkflow
      );
      await this.advance();

      this.logger.debug({ msg: 'Step skipped', stepId: currentStep.id });
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
        await this.eventManager.emit({
          type: 'workflow-failed',
          workflowId: this.currentWorkflow.id,
          instanceId: this.currentInstance.id,
          timestamp: new Date(),
        });
      }

      this.currentInstance = null;
      this.currentWorkflow = null;
      this.status = 'idle';
      await this.stateHelper.clearPersistedState();

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
    WorkflowValidator.validateRunningStatus(this.status);
    this.status = 'paused';

    if (this.currentInstance) {
      await this.stateHelper.pauseInstance(this.currentInstance);
      await this.eventManager.emit({
        type: 'workflow-paused',
        workflowId: this.currentWorkflow?.id ?? '',
        instanceId: this.currentInstance.id,
        timestamp: new Date(),
      });
    }

    this.logger.info({ msg: 'Workflow paused' });
  }

  async resume(): Promise<void> {
    WorkflowValidator.validatePausedStatus(this.status);
    this.status = 'running';

    if (this.currentInstance) {
      await this.stateHelper.resumeInstance(this.currentInstance);
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
    this.eventManager.on(event, handler);
  }

  off(event: WorkflowEvent['type'], handler: WorkflowEventHandler): void {
    this.eventManager.off(event, handler);
  }

  async emit(event: WorkflowEvent): Promise<void> {
    await this.eventManager.emit(event);
  }

  protected async onInitialize(): Promise<void> {
    const activeInstance = await this.stateHelper.loadActiveInstance();
    if (activeInstance) {
      const workflow = this.workflows.get(activeInstance.workflowId);
      if (workflow) {
        this.currentInstance = activeInstance;
        this.currentWorkflow = workflow;
        this.status = 'running';

        this.logger.info({
          msg: 'Restored active workflow instance',
          instanceId: activeInstance.id,
          workflowId: activeInstance.workflowId,
        });
      }
    }
  }

  protected async onShutdown(): Promise<void> {
    if (this.status === 'running') {
      await this.pause();
    }
    this.eventManager.removeAllListeners();
  }

  private validateAndGetWorkflow(workflowId: string): WorkflowDefinition {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    return workflow;
  }

  private checkForActiveWorkflow(): void {
    if (this.currentInstance && this.currentInstance.status === 'active') {
      throw new Error('Another workflow is already running');
    }
  }

  private createWorkflowInstance(workflowId: string, workflow: WorkflowDefinition): WorkflowInstance {
    return {
      id: randomUUID(),
      workflowId,
      currentStepId: workflow.steps[0]?.id ?? '',
      startedAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      stepStates: {},
    };
  }

  private setActiveWorkflow(instance: WorkflowInstance, workflow: WorkflowDefinition): void {
    this.currentInstance = instance;
    this.currentWorkflow = workflow;
    this.status = 'running';
  }

  private async emitWorkflowStarted(workflowId: string, instanceId: string): Promise<void> {
    await this.eventManager.emit({
      type: 'workflow-started',
      workflowId,
      instanceId,
      timestamp: new Date(),
    });
  }

  private logWorkflowStart(workflowId: string, instanceId: string): void {
    this.logger.info({
      msg: 'Workflow started',
      workflowId,
      instanceId,
    });
  }

  private validateActiveWorkflow(): { currentStep: WorkflowStep } {
    WorkflowValidator.validateActiveWorkflow(this.currentInstance, this.currentWorkflow);

    const currentStep = this.getCurrentStep();
    if (!currentStep) {
      throw new Error('Current step not found');
    }

    return { currentStep };
  }

  private logAdvancement(): void {
    if (this.currentInstance) {
      this.logger.debug({
        msg: 'Workflow advanced',
        currentStepId: this.currentInstance.currentStepId,
        status: this.currentInstance.status,
      });
    }
  }

  private logGoBack(): void {
    if (this.currentInstance) {
      this.logger.debug({
        msg: 'Workflow moved back',
        currentStepId: this.currentInstance.currentStepId,
      });
    }
  }
}