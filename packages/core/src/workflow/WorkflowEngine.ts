import { StateManager } from '../state/StateManager';
import { TransactionCoordinator } from '../state/TransactionCoordinator';
import { createLogger, type Logger } from '../utils/logger';
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
  Progress,
  Summary,
} from './types';

/**
 * WorkflowEngine - Pure business logic engine for checklist workflows
 *
 * This engine provides UI-agnostic workflow management with:
 * - State persistence and recovery
 * - Event-driven architecture for UI integration
 * - Conditional step evaluation
 * - Transaction support for atomic operations
 * - Comprehensive error handling and recovery
 */
export class WorkflowEngine extends TypedEventEmitter<WorkflowEngineEvents> {
  private state: WorkflowState;
  private template: ChecklistTemplate;
  private logger: Logger;

  // Composed services
  private stateManager: WorkflowStateManager;
  private navigator: WorkflowNavigator;
  private validator: WorkflowValidator;

  constructor(
    stateManagerImpl: StateManager,
    transactionCoordinator: TransactionCoordinator
  ) {
    super();
    this.logger = createLogger('checklist:workflow:engine');

    // Initialize composed services
    this.stateManager = new WorkflowStateManager(
      stateManagerImpl,
      transactionCoordinator
    );
    this.navigator = new WorkflowNavigator();
    this.validator = new WorkflowValidator();

    // Initialize empty state and template
    this.state = this.createInitialState();
    this.template = this.createEmptyTemplate();
  }

  async init(templateId: string, vars: Variables = {}): Promise<void> {
    try {
      this.logger.info({ msg: 'Initializing workflow engine', templateId });

      await this.stateManager.recoverFromIncompleteTransactions();
      this.state = await this.stateManager.initializeState(templateId, vars);
      this.template = await this.stateManager.loadTemplate(templateId);

      this.emit('initialized', { templateId, state: this.state });
      this.logger.info({
        msg: 'Workflow engine initialized successfully',
        templateId,
      });
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

        this.emitStepEvents(result, 'stepCompleted');
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

        this.emit('stepSkipped', {
          step: result.step,
          reason: reason ?? '',
          state: this.state,
        });
        this.emitWorkflowCompletedIfFinished(result);

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

        this.emit('workflowReset', { state: this.state });
        this.logger.info({ msg: 'Workflow reset successfully' });
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
      return {
        valid: false,
        error: 'No step to validate',
      };
    }

    try {
      return await this.validator.validateStep(
        targetStep,
        this.state,
        this.template
      );
    } catch (error) {
      this.logger.error({ msg: 'Step validation failed', error });
      return {
        valid: false,
        error: `Validation error: ${(error as Error).message}`,
      };
    }
  }

  // Getter methods
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

  // Error handling and recovery
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
      this.logger.info({ msg: 'Cleaning up workflow engine' });
      this.removeAllListeners();
      this.logger.info({ msg: 'Workflow engine cleanup completed' });
    } catch (error) {
      this.logger.error({ msg: 'Error during cleanup', error });
    }
  }

  // Helper methods
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

  private emitStepEvents(result: StepResult, eventType: string): void {
    this.emit(eventType, { step: result.step, state: this.state });

    // Emit common events that tests expect
    if (eventType === 'stepCompleted' && result.step) {
      this.emit('step:completed', result.step);
    }
    if (result.step) {
      this.emit('step:changed', result.step);
    }
    const progress: Progress = {
      currentStepIndex: this.state.currentStepIndex,
      totalSteps: this.template.steps.length,
      completedSteps: this.state.completedSteps.length,
      skippedSteps: this.state.skippedSteps.length,
      percentComplete:
        (this.state.completedSteps.length / this.template.steps.length) * 100,
    };
    this.emit('progress:updated', progress);

    this.emitWorkflowCompletedIfFinished(result);
  }

  private emitWorkflowCompletedIfFinished(_result: StepResult): void {
    if (this.state.status === 'completed') {
      const summary: Summary = {
        templateId: this.template.id,
        instanceId: this.state.currentStep?.id ?? '',
        startedAt: this.state.startedAt ?? new Date(),
        completedAt: new Date(),
        duration:
          this.state.startedAt != null
            ? Date.now() - this.state.startedAt.getTime()
            : 0,
        completedSteps: this.state.completedSteps.length,
        skippedSteps: this.state.skippedSteps.length,
        totalSteps: this.template.steps.length,
        status: this.state.status === 'completed' ? 'completed' : 'failed',
      };
      this.emit('workflowCompleted', summary);
      this.emit('workflow:completed', summary);
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

  private createInitialProgress() {
    return {
      totalSteps: 0,
      completedSteps: 0,
      percentage: 0,
    };
  }

  private createInitialSummary() {
    return {
      totalSteps: 0,
      completedSteps: 0,
      skippedSteps: 0,
      completionRate: 0,
      estimatedTimeRemaining: 0,
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
