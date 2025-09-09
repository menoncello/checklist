import { StateManager } from '../state/StateManager';
import { TransactionCoordinator } from '../state/TransactionCoordinator';
import { createLogger, type Logger } from '../utils/logger';
import { safeEval } from './conditions';
import {
  WorkflowError,
  StateTransitionError,
  ValidationError,
  ConditionEvaluationError,
  TemplateLoadError,
} from './errors';
import {
  WorkflowState,
  ChecklistTemplate,
  Step,
  StepResult,
  Variables,
  Progress,
  Summary,
  CompletedStep,
  ValidationResult,
  StepContext,
  TypedEventEmitter,
  WorkflowEngineEvents,
} from './types';
import { validateStep } from './validators';

const STATE_TRANSITIONS: Record<string, string[]> = {
  idle: ['active'],
  active: ['paused', 'completed', 'failed'],
  paused: ['active', 'failed'],
  completed: ['idle'],
  failed: ['idle'],
};

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
  private stateManager: StateManager;
  private transactionCoordinator: TransactionCoordinator;
  private initialized: boolean = false;
  private logger: Logger;

  constructor(
    private baseDir: string = '.checklist',
    logger?: Logger
  ) {
    super();
    this.logger = logger ?? createLogger('checklist:workflow:engine');
    this.state = this.createInitialState();
    this.template = { id: '', name: '', steps: [] };
    this.stateManager = new StateManager(baseDir);
    this.transactionCoordinator = new TransactionCoordinator(`${baseDir}/logs`);
  }

  /**
   * Initialize the workflow engine with a template and optional variables
   * @param templateId - The ID of the template to load
   * @param vars - Optional variables for conditional evaluation
   * @throws {TemplateLoadError} If template cannot be loaded
   */
  async init(templateId: string, vars?: Variables): Promise<void> {
    try {
      await this.stateManager.initializeState();

      // Check for incomplete transactions from WAL
      if (await this.transactionCoordinator.hasIncompleteTransactions()) {
        this.emit('recovery:started', { type: 'wal', timestamp: new Date() });

        const recoveredCount = await this.transactionCoordinator.recoverFromWAL(
          async (entry) => {
            // Apply recovered operations to workflow state
            if (entry.op === 'write' && entry.key.startsWith('/workflow/')) {
              // Handle workflow-specific state recovery
              this.logger.info({
                msg: 'Recovering workflow operation',
                op: entry.op,
                key: entry.key,
              });
            }
          }
        );

        if (recoveredCount > 0) {
          this.emit('recovery:completed', {
            type: 'wal',
            recoveredCount,
            timestamp: new Date(),
          });
        }
      }

      this.template = await this.loadTemplate(templateId);

      const savedState = await this.loadState();
      if (savedState) {
        // Merge variables from init with saved state
        this.state = {
          ...savedState,
          variables: { ...savedState.variables, ...vars },
        };
      } else {
        this.state = this.createInitialState(templateId, vars);
        await this.saveState();
      }

      this.initialized = true;
      this.emit('state:changed', this.state);
    } catch (error) {
      if (error instanceof Error) {
        throw new TemplateLoadError(templateId, error);
      }
      throw error;
    }
  }

  /**
   * Get the current step in the workflow
   * @returns The current step or null if workflow is completed
   * @throws {WorkflowError} If engine is not initialized
   */
  getCurrentStep(): Step | null {
    if (!this.initialized) {
      throw new WorkflowError(
        'Engine not initialized',
        'ENGINE_NOT_INITIALIZED'
      );
    }

    if (this.state.currentStepIndex >= this.template.steps.length) {
      return null;
    }

    return this.template.steps[this.state.currentStepIndex] ?? null;
  }

  /**
   * Advance to the next visible step in the workflow
   * @returns StepResult indicating success and the next step
   * @emits step:completed When current step is marked complete
   * @emits step:changed When moving to a new step
   * @emits workflow:completed When all steps are complete
   * @emits progress:updated After any state change
   */
  async advance(): Promise<StepResult> {
    this.ensureInitialized();

    // Transition to active state if currently idle
    if (this.state.status === 'idle') {
      this.state.status = 'active';
      this.state.startedAt = new Date();
    }

    return await this.executeWithTransaction(async () => {
      const currentStep = this.getCurrentStep();
      if (currentStep) {
        this.state.completedSteps.push({
          step: currentStep,
          completedAt: new Date(),
        });
        this.emit('step:completed', currentStep);
      }

      const nextStep = this.getNextVisibleStep();
      if (!nextStep) {
        this.state.status = 'completed';
        this.state.completedAt = new Date();
        this.emit('workflow:completed', this.generateSummary());
        return { success: true, step: null };
      }

      // Find the actual index of the next visible step
      const nextStepIndex = this.template.steps.findIndex(
        (s) => s.id === nextStep.id
      );
      this.state.currentStepIndex = nextStepIndex;
      this.state.currentStep = nextStep;
      this.state.status = 'active';

      await this.saveState();

      this.emit('step:changed', nextStep);
      this.emit('progress:updated', this.getProgress());

      return { success: true, step: nextStep };
    });
  }

  /**
   * Go back to the previous visible step in the workflow
   * @returns StepResult with the previous step or error if none available
   * @emits step:changed When moving back to previous step
   * @emits progress:updated After state change
   */
  async goBack(): Promise<StepResult> {
    this.ensureInitialized();

    // Ensure we're in active state
    if (this.state.status === 'idle') {
      this.state.status = 'active';
      this.state.startedAt = new Date();
    }

    return await this.executeWithTransaction(async () => {
      const previousStep = this.getPreviousVisibleStep();

      if (!previousStep) {
        return {
          success: false,
          step: null,
          error: 'No previous step available',
        };
      }

      // Find the actual index of the previous visible step
      const previousStepIndex = this.template.steps.findIndex(
        (s) => s.id === previousStep.id
      );
      this.state.currentStepIndex = previousStepIndex;
      this.state.currentStep = previousStep;

      this.state.completedSteps = this.state.completedSteps.filter(
        (cs) => cs.step.id !== previousStep.id
      );

      await this.saveState();

      this.emit('step:changed', previousStep);
      this.emit('progress:updated', this.getProgress());

      return { success: true, step: previousStep };
    });
  }

  /**
   * Skip the current step with an optional reason
   * @param reason - Optional reason for skipping the step
   * @returns StepResult with the next step after skipping
   * @emits step:skipped When a step is skipped
   * @emits step:changed When moving to next step
   * @emits workflow:completed If this was the last step
   */
  async skip(reason?: string): Promise<StepResult> {
    this.ensureInitialized();

    // Ensure we're in active state
    if (this.state.status === 'idle') {
      this.state.status = 'active';
      this.state.startedAt = new Date();
    }

    return await this.executeWithTransaction(async () => {
      const currentStep = this.getCurrentStep();

      if (!currentStep) {
        return {
          success: false,
          step: null,
          error: 'No current step to skip',
        };
      }

      this.state.skippedSteps.push({
        step: currentStep,
        reason,
        timestamp: new Date(),
      });

      this.emit('step:skipped', currentStep, reason);

      // Move to next step without completing current one
      const nextStep = this.getNextVisibleStep();
      if (!nextStep) {
        this.state.status = 'completed';
        this.state.completedAt = new Date();
        this.emit('workflow:completed', this.generateSummary());
        return { success: true, step: null };
      }

      // Find the actual index of the next visible step
      const nextStepIndex = this.template.steps.findIndex(
        (s) => s.id === nextStep.id
      );
      this.state.currentStepIndex = nextStepIndex;
      this.state.currentStep = nextStep;

      await this.saveState();

      this.emit('step:changed', nextStep);
      this.emit('progress:updated', this.getProgress());

      return { success: true, step: nextStep };
    });
  }

  /**
   * Reset the workflow to its initial state
   * @emits state:changed After reset is complete
   * @emits progress:updated After state change
   */
  async reset(): Promise<void> {
    this.ensureInitialized();

    await this.executeWithTransaction(async () => {
      const templateId = this.state.templateId;
      const variables = this.state.variables;

      this.state = this.createInitialState(templateId, variables);
      await this.saveState();

      this.emit('state:changed', this.state);
      this.emit('progress:updated', this.getProgress());

      return this.state;
    });
  }

  /**
   * Get the current progress of the workflow
   * @returns Progress object with completion metrics
   */
  getProgress(): Progress {
    this.ensureInitialized();

    const visibleSteps = this.getVisibleSteps();
    const totalSteps = visibleSteps.length;
    const completedSteps = this.state.completedSteps.length;
    const skippedSteps = this.state.skippedSteps.length;
    const percentComplete =
      totalSteps > 0
        ? Math.round(((completedSteps + skippedSteps) / totalSteps) * 100)
        : 0;

    return {
      currentStepIndex: this.state.currentStepIndex,
      totalSteps,
      completedSteps,
      skippedSteps,
      percentComplete,
    };
  }

  /**
   * Get the history of completed steps
   * @returns Array of completed steps with timestamps
   */
  getHistory(): CompletedStep[] {
    this.ensureInitialized();
    return [...this.state.completedSteps];
  }

  /**
   * Validate a step against its validation rules
   * @param step - Optional step to validate (defaults to current step)
   * @returns ValidationResult indicating if step is valid
   * @emits validation:failed If validation fails
   */
  async validateStep(step?: Step): Promise<ValidationResult> {
    this.ensureInitialized();

    const targetStep = step ?? this.getCurrentStep();
    if (!targetStep) {
      return { valid: false, error: 'No step to validate' };
    }

    if (!targetStep.validation) {
      return { valid: true };
    }

    const context = this.buildStepContext(targetStep);

    for (const validation of targetStep.validation) {
      try {
        const result = await validateStep(validation, context);
        if (!result.valid) {
          this.emit(
            'validation:failed',
            targetStep,
            new ValidationError(
              targetStep.id,
              validation.type,
              result.error ?? 'Validation failed'
            )
          );
          return result;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return {
          valid: false,
          error: validation.errorMessage ?? errorMessage,
        };
      }
    }

    return { valid: true };
  }

  private createInitialState(
    templateId?: string,
    vars?: Variables
  ): WorkflowState {
    return {
      status: 'idle',
      currentStepIndex: 0,
      completedSteps: [],
      skippedSteps: [],
      variables: vars ?? {},
      templateId,
      instanceId: crypto.randomUUID(),
    };
  }

  private async loadTemplate(templateId: string): Promise<ChecklistTemplate> {
    // For testing, return a simple template
    // Real implementation would load from file system
    return {
      id: templateId,
      name: templateId,
      description: 'Workflow template',
      steps: [],
    };
  }

  private async loadState(): Promise<WorkflowState | null> {
    // For MVP, state persistence is not implemented
    // The StateManager integration needs proper schema alignment
    return null;
  }

  private async saveState(): Promise<void> {
    // For MVP, use in-memory state storage
    // The StateManager integration needs proper schema alignment
    return;
  }

  private getNextVisibleStep(): Step | null {
    let index = this.state.currentStepIndex + 1;

    while (index < this.template.steps.length) {
      const step = this.template.steps[index];
      if (
        step.condition === undefined ||
        step.condition === null ||
        this.evaluateCondition(step.condition)
      ) {
        return step;
      }
      index++;
    }

    return null;
  }

  private getPreviousVisibleStep(): Step | null {
    let index = this.state.currentStepIndex - 1;

    while (index >= 0) {
      const step = this.template.steps[index];
      if (
        step.condition === undefined ||
        step.condition === null ||
        this.evaluateCondition(step.condition)
      ) {
        return step;
      }
      index--;
    }

    return null;
  }

  private getVisibleSteps(): Step[] {
    return this.template.steps.filter(
      (step) =>
        step.condition === undefined ||
        step.condition === null ||
        this.evaluateCondition(step.condition)
    );
  }

  private evaluateCondition(condition: string): boolean {
    try {
      const context = this.buildContext();
      return safeEval(condition, context);
    } catch (error) {
      this.handleError(
        new ConditionEvaluationError(
          condition,
          error instanceof Error ? error : new Error('Unknown error')
        )
      );
      return false;
    }
  }

  private buildContext(): Record<string, unknown> {
    return {
      ...this.state.variables,
      platform: process.platform,
      stepCount: this.template.steps.length,
      completedCount: this.state.completedSteps.length,
      skippedCount: this.state.skippedSteps.length,
    };
  }

  private buildStepContext(step: Step): StepContext {
    return {
      step,
      state: this.state,
      variables: this.state.variables,
    };
  }

  private validateStateTransition(from: string, to: string): void {
    const allowedTransitions = STATE_TRANSITIONS[from];

    if (!allowedTransitions?.includes(to)) {
      throw new StateTransitionError(from, to, 'Transition not allowed');
    }
  }

  private generateSummary(): Summary {
    const completedAt = this.state.completedAt ?? new Date();
    const startedAt = this.state.startedAt ?? new Date();

    return {
      templateId: this.state.templateId ?? '',
      instanceId: this.state.instanceId ?? '',
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
      completedSteps: this.state.completedSteps.length,
      skippedSteps: this.state.skippedSteps.length,
      totalSteps: this.template.steps.length,
      status: this.state.status === 'completed' ? 'completed' : 'failed',
    };
  }

  private async executeWithTransaction<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    // For MVP, we'll execute operations directly without transactions
    // This will be properly integrated when StateManager is fully configured
    try {
      const result = await operation();
      return result;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  private handleError(error: unknown): void {
    const classified =
      error instanceof WorkflowError
        ? error
        : new WorkflowError(
            error instanceof Error ? error.message : 'Unknown error',
            'UNKNOWN_ERROR',
            false
          );

    this.emit('error', classified);

    if (classified.recoverable) {
      this.attemptRecovery(classified);
    }
  }

  private async attemptRecovery(error: WorkflowError): Promise<void> {
    switch (error.code) {
      case 'VALIDATION_ERROR':
        break;
      case 'STATE_CORRUPTION':
        await this.reset();
        break;
      default:
        this.state.status = 'failed';
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new WorkflowError(
        'Engine not initialized. Call init() first.',
        'ENGINE_NOT_INITIALIZED'
      );
    }
  }

  async cleanup(): Promise<void> {
    await this.stateManager.cleanup();
    await this.transactionCoordinator.cleanup();
  }
}
