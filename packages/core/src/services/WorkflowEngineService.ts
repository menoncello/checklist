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
import { WorkflowEventHelper } from './WorkflowEventHelper';
import { WorkflowEventManager } from './WorkflowEventManager';
import { WorkflowInstanceManager } from './WorkflowInstanceManager';
import { WorkflowLoader } from './WorkflowLoader';
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
  private currentInstance: WorkflowInstance | null = null;
  private currentWorkflow: WorkflowDefinition | null = null;
  private stateManager: IStateManager;
  private stateHelper: WorkflowStateHelper;
  private eventManager: WorkflowEventManager;
  private stepManager: WorkflowStepManager;
  private instanceManager: WorkflowInstanceManager;
  private workflowLoader: WorkflowLoader;
  private eventHelper: WorkflowEventHelper;
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
    this.instanceManager = new WorkflowInstanceManager(logger);
    this.workflowLoader = new WorkflowLoader(logger);
    this.eventHelper = new WorkflowEventHelper(this.eventManager);
  }

  async loadWorkflow(definition: WorkflowDefinition): Promise<void> {
    await this.workflowLoader.loadWorkflow(definition);
  }

  async startWorkflow(workflowId: string): Promise<WorkflowInstance> {
    try {
      const workflow = this.workflowLoader.getWorkflow(workflowId);
      this.instanceManager.checkForActiveWorkflow(this.currentInstance);

      const instance = this.instanceManager.createInstance(
        workflowId,
        workflow
      );
      this.stateHelper.initializeStepStates(instance, workflow.steps);

      this.setActiveWorkflow(instance, workflow);
      await this.stateHelper.persistWorkflowStart(instance);
      await this.eventHelper.emitWorkflowStarted(workflowId, instance.id);
      this.instanceManager.logWorkflowStart(workflowId, instance.id);
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
    return WorkflowValidator.findCurrentStep(
      this.currentInstance,
      this.currentWorkflow
    );
  }

  async advance(): Promise<void> {
    try {
      const { currentStep } = this.validateActiveWorkflow();
      await this.stepManager.completeCurrentStep(
        currentStep,
        this.currentInstance,
        this.currentWorkflow
      );

      const nextStepId = this.stepManager.findNextStep(
        currentStep,
        this.currentWorkflow
      );
      await this.handleStepTransition(nextStepId);

      await this.stateHelper.saveWorkflowState(this.currentInstance);
      this.instanceManager.logAdvancement(this.currentInstance);
    } catch (error) {
      this.logger.error({
        msg: 'Failed to advance workflow',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async handleStepTransition(
    nextStepId: string | null | undefined
  ): Promise<void> {
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
      this.instanceManager.logGoBack(this.currentInstance);
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
      this.instanceManager.logSkip(currentStep.id);
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
        await this.eventHelper.emitWorkflowFailed(
          this.currentWorkflow.id,
          this.currentInstance.id
        );
      }

      this.currentInstance = null;
      this.currentWorkflow = null;
      this.status = 'idle';
      await this.stateHelper.clearPersistedState();
      this.instanceManager.logReset();
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

    if (this.currentInstance && this.currentWorkflow) {
      await this.stateHelper.pauseInstance(this.currentInstance);
      await this.eventHelper.emitWorkflowPaused(
        this.currentWorkflow.id,
        this.currentInstance.id
      );
    }
    this.instanceManager.logPause();
  }

  async resume(): Promise<void> {
    WorkflowValidator.validatePausedStatus(this.status);
    this.status = 'running';

    if (this.currentInstance) {
      await this.stateHelper.resumeInstance(this.currentInstance);
    }
    this.instanceManager.logResume();
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
    await this.eventHelper.emit(event);
  }

  protected async onInitialize(): Promise<void> {
    const activeInstance = await this.stateHelper.loadActiveInstance();
    if (
      activeInstance &&
      this.workflowLoader.hasWorkflow(activeInstance.workflowId)
    ) {
      const workflow = this.workflowLoader.getWorkflow(
        activeInstance.workflowId
      );
      this.currentInstance = activeInstance;
      this.currentWorkflow = workflow;
      this.status = 'running';
      this.instanceManager.logRestoration(
        activeInstance.id,
        activeInstance.workflowId
      );
    }
  }

  protected async onShutdown(): Promise<void> {
    if (this.status === 'running') {
      await this.pause();
    }
    this.eventManager.removeAllListeners();
  }

  private setActiveWorkflow(
    instance: WorkflowInstance,
    workflow: WorkflowDefinition
  ): void {
    this.currentInstance = instance;
    this.currentWorkflow = workflow;
    this.status = 'running';
  }

  private validateActiveWorkflow(): { currentStep: WorkflowStep } {
    WorkflowValidator.validateActiveWorkflow(
      this.currentInstance,
      this.currentWorkflow
    );

    const currentStep = this.getCurrentStep();
    if (!currentStep) {
      throw new Error('Current step not found');
    }

    return { currentStep };
  }
}
