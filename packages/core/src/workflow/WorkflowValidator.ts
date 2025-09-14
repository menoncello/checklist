import { createLogger, type Logger } from '../utils/logger';
import { ValidationError, ConditionEvaluationError } from './errors';
import {
  WorkflowState,
  ChecklistTemplate,
  Step,
  ValidationResult,
  StepContext,
  StepValidation,
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
      const result = await this.runValidations(step, stepContext);
      this.logStepValidationComplete(step, result);
      return result;
    } catch (error) {
      return this.handleValidationError(step, error as Error);
    }
  }

  private logStepValidationStart(step: Step): void {
    this.logger.debug({ msg: 'Validating step', stepId: step.id, stepTitle: step.title });
  }

  private logStepValidationComplete(step: Step, result: ValidationResult): void {
    this.logger.debug({
      msg: 'Step validation completed',
      stepId: step.id,
      isValid: result.isValid,
      errors: result.errors.length,
      warnings: result.warnings.length,
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
      isValid: false,
      errors: [errorMessage],
      warnings: [],
    };
  }

  private async runValidations(
    targetStep: Step,
    stepContext: StepContext
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Run built-in validations
    try {
      const builtInResult = await validateStepFunction(targetStep, stepContext);
      if (builtInResult.isValid !== true) {
        errors.push(...builtInResult.errors);
        warnings.push(...builtInResult.warnings);
      }
    } catch (error) {
      errors.push(`Built-in validation failed: ${(error as Error).message}`);
    }

    // Run custom validations if defined
    if (targetStep.validations !== null && targetStep.validations !== undefined && targetStep.validations.length > 0) {
      await this.runAllCustomValidations(targetStep.validations, stepContext, errors, warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async runAllCustomValidations(
    validations: StepValidation[],
    stepContext: StepContext,
    errors: string[],
    warnings: string[]
  ): Promise<void> {
    for (const validation of validations) {
      try {
        const customResult = await this.runCustomValidation(validation, stepContext);
        if (customResult.isValid !== true) {
          errors.push(...customResult.errors);
          warnings.push(...customResult.warnings);
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
      if (validation.type === 'condition' && validation.condition !== null && validation.condition !== undefined) {
        // Simple condition validation
        const result = this.evaluateCondition(validation.condition, stepContext);
        return {
          isValid: result,
          errors: result === true ? [] : [validation.message ?? 'Condition validation failed'],
          warnings: [],
        };
      }

      if (validation.type === 'custom' && validation.validator !== null && validation.validator !== undefined) {
        // Custom validator function
        return await validation.validator(stepContext);
      }

      return {
        isValid: true,
        errors: [],
        warnings: [],
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${(error as Error).message}`],
        warnings: [],
      };
    }
  }

  validateStateTransition(from: string, to: string): void {
    const allowedTransitions = STATE_TRANSITIONS[from];

    if (!allowedTransitions?.includes(to)) {
      throw new ValidationError(
        `Invalid state transition from '${from}' to '${to}'. ` +
        `Allowed transitions from '${from}': ${allowedTransitions?.join(', ') || 'none'}`
      );
    }
  }

  private buildStepContext(
    step: Step,
    state: WorkflowState,
    template: ChecklistTemplate
  ): StepContext {
    return {
      step,
      state,
      template,
      variables: state.variables,
      completedSteps: state.completedSteps,
      currentStepIndex: state.currentStepIndex,
    };
  }

  private evaluateCondition(condition: string, stepContext: StepContext): boolean {
    try {
      // Simple condition evaluation using context variables
      const context = {
        vars: stepContext.variables,
        completedSteps: stepContext.completedSteps.map(step => step.stepId),
        currentStepIndex: stepContext.currentStepIndex,
        progress: stepContext.state.progress,
      };

      // For now, just check if condition string evaluates to truthy
      // In a real implementation, this would use a safe expression evaluator
      return this.safeEvaluateCondition(condition, context);
    } catch (error) {
      throw new ConditionEvaluationError(
        `Failed to evaluate condition: ${condition}`,
        condition,
        error as Error
      );
    }
  }

  private safeEvaluateCondition(condition: string, context: Record<string, unknown>): boolean {
    try {
      // Simple variable substitution for basic conditions
      let evaluatedCondition = condition;

      // Replace variable references
      for (const [key, value] of Object.entries(context)) {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        evaluatedCondition = evaluatedCondition.replace(regex, JSON.stringify(value));
      }

      // For safety, only allow simple boolean expressions
      if (!/^[a-zA-Z0-9\s\[\]"'.,{}:()&|!<>=+-/*%]+$/.test(evaluatedCondition)) {
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