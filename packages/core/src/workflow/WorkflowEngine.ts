import { StateManager } from '../state/StateManager';
import { TransactionCoordinator } from '../state/TransactionCoordinator';
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

export class WorkflowEngine extends TypedEventEmitter<WorkflowEngineEvents> {
  private state: WorkflowState;
  private template: ChecklistTemplate;
  private stateManager: StateManager;
  private transactionCoordinator: TransactionCoordinator;
  private initialized: boolean = false;

  constructor(private baseDir: string = '.checklist') {
    super();
    this.state = this.createInitialState();
    this.template = { id: '', name: '', steps: [] };
    this.stateManager = new StateManager(baseDir);
    this.transactionCoordinator = new TransactionCoordinator(`${baseDir}/logs`);
  }

  async init(templateId: string, vars?: Variables): Promise<void> {
    try {
      await this.stateManager.initializeState();

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

  getHistory(): CompletedStep[] {
    this.ensureInitialized();
    return [...this.state.completedSteps];
  }

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
    return {
      id: templateId,
      name: templateId,
      description: 'Workflow template',
      steps: [],
    };
  }

  private async loadState(): Promise<WorkflowState | null> {
    try {
      const checklistState = await this.stateManager.loadState();

      if (Array.isArray(checklistState.completedSteps)) {
        return {
          status: 'active',
          currentStepIndex: checklistState.completedSteps.length,
          completedSteps: [],
          skippedSteps: [],
          variables: {},
          instanceId: crypto.randomUUID(),
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  private async saveState(): Promise<void> {
    // For MVP, we'll skip actual state persistence to avoid dependency issues
    // This will be properly integrated when StateManager is fully configured
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

  private buildContext(): Record<string, any> {
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
