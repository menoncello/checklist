import { StateManager } from '../state/StateManager';
import { TransactionCoordinator } from '../state/TransactionCoordinator';
import { createLogger, type Logger } from '../utils/logger';
import type { ConditionalEvaluationEngine } from './ConditionalEvaluationEngine';
import { WorkflowConditionalHelper } from './WorkflowConditionalHelper';
import { WorkflowEventHelper } from './WorkflowEventHelper';
import { WorkflowNavigator } from './WorkflowNavigator';
import { WorkflowStateManager } from './WorkflowStateManager';
import { WorkflowValidator } from './WorkflowValidator';
import { WorkflowError } from './errors';
import {
  ChecklistTemplate,
  Step,
  StepResult,
  TypedEventEmitter,
  ValidationResult,
  Variables,
  WorkflowEngineEvents,
  WorkflowState,
} from './types';

/**
 * Pure business logic engine for checklist workflows with state persistence,
 * event-driven architecture, conditional evaluation, and transaction support.
 */
export class WorkflowEngine extends TypedEventEmitter<WorkflowEngineEvents> {
  private state: WorkflowState;
  private template: ChecklistTemplate;
  private logger: Logger;

  // Composed services
  private stateManager: WorkflowStateManager;
  private navigator: WorkflowNavigator;
  private validator: WorkflowValidator;
  private conditionalHelper: WorkflowConditionalHelper;
  private eventHelper: WorkflowEventHelper;

  constructor(
    stateManagerImpl: StateManager,
    transactionCoordinator: TransactionCoordinator,
    conditionalEngine?: ConditionalEvaluationEngine
  ) {
    super();
    this.logger = createLogger('checklist:workflow:engine');

    // Initialize empty state and template first
    this.state = this.createInitialState();
    this.template = this.createEmptyTemplate();

    // Initialize composed services
    this.stateManager = new WorkflowStateManager(
      stateManagerImpl,
      transactionCoordinator
    );
    this.navigator = new WorkflowNavigator();
    this.validator = new WorkflowValidator();
    this.conditionalHelper = new WorkflowConditionalHelper(conditionalEngine);
    this.eventHelper = new WorkflowEventHelper(
      this,
      () => this.state,
      () => this.template
    );
  }

  async init(templateId: string, vars: Variables = {}): Promise<void> {
    try {
      this.logger.info({ msg: 'Initializing workflow engine', templateId });

      await this.stateManager.recoverFromIncompleteTransactions();
      this.state = await this.stateManager.initializeState(templateId, vars);
      this.template = await this.stateManager.loadTemplate(templateId);
      await this.evaluateAllConditions();

      this.emit('initialized', { templateId, state: this.state });
      this.logger.info({ msg: 'Workflow engine initialized', templateId });
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async advance(): Promise<StepResult> {
    this.ensureInitialized();

    try {
      return await this.executeWithTransaction('advance', async () => {
        const { newState, result } = await this.navigator.advance(
          this.state,
          this.template
        );

        this.state = newState;
        await this.stateManager.saveState(this.state);
        await this.evaluateAllConditions();

        this.eventHelper.emitStepEvents(result, 'stepCompleted');
        return result;
      });
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async goBack(): Promise<StepResult> {
    this.ensureInitialized();

    try {
      return await this.executeWithTransaction('goBack', async () => {
        const { newState, result } = await this.navigator.goBack(
          this.state,
          this.template
        );

        if (result.success) {
          this.state = newState;
          await this.stateManager.saveState(this.state);
          this.emit('stepReverted', { step: result.step, state: this.state });
        }

        return result;
      });
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async skip(reason?: string): Promise<StepResult> {
    this.ensureInitialized();

    try {
      return await this.executeWithTransaction('skip', async () => {
        const { newState, result } = await this.navigator.skip(
          this.state,
          this.template,
          reason
        );

        this.state = newState;
        await this.stateManager.saveState(this.state);
        await this.evaluateAllConditions();

        this.emit('stepSkipped', {
          step: result.step,
          reason: reason ?? '',
          state: this.state,
        });
        this.eventHelper.emitStepEvents(result, 'stepSkipped');

        return result;
      });
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async reset(): Promise<void> {
    this.ensureInitialized();

    try {
      await this.executeWithTransaction('reset', async () => {
        this.state = await this.stateManager.initializeState(
          this.state.templateId ?? '',
          this.state.variables
        );
        await this.stateManager.saveState(this.state);
        await this.evaluateAllConditions();

        this.emit('workflowReset', { state: this.state });
        this.logger.info({ msg: 'Workflow reset' });
      });
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async validateStep(step?: Step): Promise<ValidationResult> {
    this.ensureInitialized();

    const targetStep = step ?? this.getCurrentStep();
    if (!targetStep) {
      return { valid: false, error: 'No step to validate' };
    }

    return await this.validator.validateStep(
      targetStep,
      this.state,
      this.template
    );
  }

  getCurrentStep(): Step | null {
    if (
      this.template?.steps === undefined ||
      this.state.currentStepIndex >= this.template.steps.length
    ) {
      return null;
    }
    return this.template.steps[this.state.currentStepIndex];
  }

  getState(): WorkflowState {
    return { ...this.state };
  }

  getTemplate(): ChecklistTemplate {
    return { ...this.template };
  }

  isInitialized(): boolean {
    return Boolean(this.state.templateId !== '' && this.template.id !== '');
  }

  getVisibleSteps(): Step[] {
    return this.conditionalHelper.getVisibleSteps(this.template);
  }

  async evaluateAllConditions(): Promise<void> {
    await this.conditionalHelper.evaluateAll(this.template, this.state);
  }

  async reevaluateConditions(): Promise<void> {
    await this.conditionalHelper.reevaluate(this.template, this.state);
    this.emit('state:changed', this.state);
  }

  private handleError(error: unknown): void {
    const workflowError =
      error instanceof WorkflowError
        ? error
        : new WorkflowError('Unexpected error', (error as Error).message);

    this.logger.error({
      msg: 'Workflow error occurred',
      error: workflowError.message,
      code: workflowError.code,
      context: workflowError.context,
    });

    this.emit('error', workflowError);
  }

  private ensureInitialized(): void {
    if (!this.isInitialized()) {
      throw new WorkflowError(
        'Workflow engine is not initialized. Call init() first.',
        'WORKFLOW_NOT_INITIALIZED'
      );
    }
  }

  async cleanup(): Promise<void> {
    try {
      this.removeAllListeners();
      this.logger.info({ msg: 'Workflow engine cleanup completed' });
    } catch (error) {
      this.logger.error({ msg: 'Error during cleanup', error });
    }
  }

  private async executeWithTransaction<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const transactionId = await this.stateManager.beginTransaction(operation);

    try {
      const result = await fn();
      await this.stateManager.commitTransaction(transactionId);
      return result;
    } catch (error) {
      await this.stateManager.rollbackTransaction(transactionId);
      throw error;
    }
  }

  private createInitialState(): WorkflowState {
    return {
      currentStepIndex: 0,
      status: 'idle',
      variables: {},
      completedSteps: [],
      skippedSteps: [],
      templateId: '',
    };
  }

  private createEmptyTemplate(): ChecklistTemplate {
    return {
      id: '',
      name: '',
      version: '1.0.0',
      steps: [],
      metadata: {},
    };
  }
}
