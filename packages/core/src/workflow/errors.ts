export class WorkflowError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = false,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'WorkflowError';
  }
}

export class StateTransitionError extends WorkflowError {
  constructor(from: string, to: string, reason: string) {
    super(
      `Invalid state transition from ${from} to ${to}: ${reason}`,
      'STATE_TRANSITION_ERROR',
      false,
      { from, to, reason }
    );
  }
}

export class ValidationError extends WorkflowError {
  constructor(step: string, validation: string, details: string) {
    super(
      `Validation failed for step ${step}: ${details}`,
      'VALIDATION_ERROR',
      true,
      { step, validation, details }
    );
  }
}

export class ConditionEvaluationError extends WorkflowError {
  constructor(condition: string, error: Error) {
    super(
      `Failed to evaluate condition: ${condition}`,
      'CONDITION_ERROR',
      false,
      { condition, originalError: error.message }
    );
  }
}

export class StateCorruptionError extends WorkflowError {
  constructor(details: string) {
    super(`State corruption detected: ${details}`, 'STATE_CORRUPTION', true, {
      details,
    });
  }
}

export class TemplateLoadError extends WorkflowError {
  constructor(templateId: string, error: Error) {
    super(
      `Failed to load template ${templateId}: ${error.message}`,
      'TEMPLATE_LOAD_ERROR',
      false,
      { templateId, originalError: error.message }
    );
  }
}
