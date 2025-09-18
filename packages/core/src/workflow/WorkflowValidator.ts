import { createLogger, type Logger } from '../utils/logger';
import { ValidationError, ConditionEvaluationError } from './errors';
import {
  WorkflowState,
  ChecklistTemplate,
  Step,
  ValidationResult,
  StepContext,
  StepValidation,
  CompletedStep,
} from './types';
import { validateStep as validateStepFunction } from './validators';

const STATE_TRANSITIONS: Record<string, string[]> = {
  idle: ['active'],
  active: ['paused', 'completed', 'failed'],
  paused: ['active', 'failed'],
  completed: ['idle'],
  failed: ['idle'],
};

export class WorkflowValidator {
  private logger: Logger;

  constructor() {
    this.logger = createLogger('checklist:workflow:validator');
  }

  async validateStep(
    step: Step,
    state: WorkflowState,
    template: ChecklistTemplate
  ): Promise<ValidationResult> {
    try {
      this.logStepValidationStart(step);
      const stepContext = this.buildStepContext(step, state, template);
      const result = await this.runValidations(step, stepContext, template);
      this.logStepValidationComplete(step, result);
      return result;
    } catch (error) {
      return this.handleValidationError(step, error as Error);
    }
  }

  private logStepValidationStart(step: Step): void {
    this.logger.debug({
      msg: 'Validating step',
      stepId: step.id,
      stepTitle: step.title,
    });
  }

  private logStepValidationComplete(
    step: Step,
    result: ValidationResult
  ): void {
    this.logger.debug({
      msg: 'Step validation completed',
      stepId: step.id,
      isValid: result.valid,
      error: result.error,
    });
  }

  private handleValidationError(step: Step, error: Error): ValidationResult {
    const errorMessage = error.message;
    this.logger.error({
      msg: 'Step validation failed',
      stepId: step.id,
      error: errorMessage,
    });
    return {
      valid: false,
      error: errorMessage,
    };
  }

  private async runValidations(
    targetStep: Step,
    stepContext: StepContext,
    template: ChecklistTemplate
  ): Promise<ValidationResult> {
    const errors: string[] = [];

    await this.runBuiltInValidations(targetStep, stepContext, errors);
    await this.runAllCustomValidations(
      targetStep,
      stepContext,
      template,
      errors
    );

    return {
      valid: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }

  private async runBuiltInValidations(
    targetStep: Step,
    stepContext: StepContext,
    errors: string[]
  ): Promise<void> {
    if (!targetStep.validation || targetStep.validation.length === 0) return;

    for (const validation of targetStep.validation) {
      try {
        const result = await validateStepFunction(validation, stepContext);
        if (!result.valid) {
          errors.push(result.error ?? 'Validation failed');
        }
      } catch (error) {
        errors.push(`Built-in validation failed: ${(error as Error).message}`);
      }
    }
  }

  private async runAllCustomValidations(
    targetStep: Step,
    stepContext: StepContext,
    template: ChecklistTemplate,
    errors: string[]
  ): Promise<void> {
    // Check for condition-based validation
    if (targetStep.condition != null && targetStep.condition !== '') {
      try {
        const conditionResult = this.evaluateCondition(
          targetStep.condition,
          stepContext,
          template
        );
        if (!conditionResult) {
          errors.push(`Condition validation failed for step: ${targetStep.id}`);
        }
      } catch (error) {
        errors.push(`Custom validation failed: ${(error as Error).message}`);
      }
    }
  }

  private async runCustomValidation(
    validation: StepValidation,
    stepContext: StepContext
  ): Promise<ValidationResult> {
    try {
      // StepValidation has type, check, and errorMessage properties
      // We'll validate based on the type
      if (validation.type === 'custom') {
        // For custom type, we can check the condition in the check field
        const result = this.safeEvaluateCondition(validation.check, {
          vars: stepContext.variables,
          step: stepContext.step,
        });
        return {
          valid: result,
          error: result
            ? undefined
            : (validation.errorMessage ?? 'Custom validation failed'),
        };
      }

      return {
        valid: true,
        error: undefined,
      };
    } catch (error) {
      return {
        valid: false,
        error: `Validation error: ${(error as Error).message}`,
      };
    }
  }

  validateStateTransition(from: string, to: string): void {
    const allowedTransitions = STATE_TRANSITIONS[from];

    if (!allowedTransitions?.includes(to)) {
      throw new ValidationError(
        from,
        'state_transition',
        `Invalid state transition from '${from}' to '${to}'. ` +
          `Allowed transitions from '${from}': ${allowedTransitions?.join(', ') || 'none'}`
      );
    }
  }

  private buildStepContext(
    step: Step,
    state: WorkflowState,
    _template: ChecklistTemplate
  ): StepContext {
    return {
      step,
      state,
      variables: state.variables,
    };
  }

  private evaluateCondition(
    condition: string,
    stepContext: StepContext,
    template: ChecklistTemplate
  ): boolean {
    try {
      // Simple condition evaluation using context variables
      const completedStepIds = stepContext.state.completedSteps.map(
        (cs: CompletedStep) => cs.step.id
      );
      const progress = this.calculateProgress(stepContext.state, template);

      const context = {
        vars: stepContext.variables,
        completedSteps: completedStepIds,
        currentStepIndex: stepContext.state.currentStepIndex,
        progress: progress,
      };

      // For now, just check if condition string evaluates to truthy
      // In a real implementation, this would use a safe expression evaluator
      return this.safeEvaluateCondition(condition, context);
    } catch (error) {
      throw new ConditionEvaluationError(condition, error as Error);
    }
  }

  private calculateProgress(
    state: WorkflowState,
    template: ChecklistTemplate
  ): number {
    const totalSteps = template.steps.length;
    const completedSteps = state.completedSteps.length;
    return totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  }

  private safeEvaluateCondition(
    condition: string,
    context: Record<string, unknown>
  ): boolean {
    try {
      // Simple variable substitution for basic conditions
      let evaluatedCondition = condition;

      // Replace variable references
      for (const [key, value] of Object.entries(context)) {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        evaluatedCondition = evaluatedCondition.replace(
          regex,
          JSON.stringify(value)
        );
      }

      // For safety, only allow simple boolean expressions
      if (
        !/^[a-zA-Z0-9\s\[\]"'.,{}:()&|!<>=+-/*%]+$/.test(evaluatedCondition)
      ) {
        throw new Error('Unsafe expression detected');
      }

      // This is a simplified evaluation - in production, use a proper expression evaluator
      return Boolean(JSON.parse(evaluatedCondition.toLowerCase()));
    } catch (error) {
      this.logger.warn({
        msg: 'Condition evaluation failed, defaulting to false',
        condition,
        error: (error as Error).message,
      });
      return false;
    }
  }
}
