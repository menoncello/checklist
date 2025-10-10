/**
 * Variable Management System - Error Classes
 * Specialized errors for variable operations
 */

/**
 * Base error for variable-related operations
 */
export class VariableError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'VariableError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error when a variable is not found
 */
export class VariableNotFoundError extends VariableError {
  constructor(
    public readonly variableName: string,
    public readonly scope?: string
  ) {
    super(
      `Variable '${variableName}' not found${scope !== undefined && scope !== '' ? ` in scope '${scope}'` : ''}`,
      { variableName, scope }
    );
    this.name = 'VariableNotFoundError';
  }
}

/**
 * Error when variable validation fails
 */
export class VariableValidationError extends VariableError {
  constructor(
    public readonly variableName: string,
    public readonly validationError: string,
    context?: Record<string, unknown>
  ) {
    super(`Variable '${variableName}' validation failed: ${validationError}`, {
      variableName,
      validationError,
      ...context,
    });
    this.name = 'VariableValidationError';
  }
}

/**
 * Error when circular dependencies are detected
 */
export class CircularDependencyError extends VariableError {
  constructor(
    public readonly variableName: string,
    public readonly dependencyChain: string[]
  ) {
    super(
      `Circular dependency detected for variable '${variableName}': ${dependencyChain.join(' -> ')}`,
      { variableName, dependencyChain }
    );
    this.name = 'CircularDependencyError';
  }
}

/**
 * Error for security violations in variable operations
 */
export class VariableSecurityError extends VariableError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(`Security violation: ${message}`, context);
    this.name = 'VariableSecurityError';
  }
}

/**
 * Error when variable type is invalid
 */
export class InvalidVariableTypeError extends VariableError {
  constructor(
    public readonly variableName: string,
    public readonly expectedType: string,
    public readonly actualType: string
  ) {
    super(
      `Variable '${variableName}' has invalid type. Expected ${expectedType}, got ${actualType}`,
      { variableName, expectedType, actualType }
    );
    this.name = 'InvalidVariableTypeError';
  }
}

/**
 * Error when computed variable evaluation fails
 */
export class ComputedVariableError extends VariableError {
  constructor(
    public readonly variableName: string,
    public readonly expression: string,
    public readonly reason: string
  ) {
    super(`Failed to evaluate computed variable '${variableName}': ${reason}`, {
      variableName,
      expression,
      reason,
    });
    this.name = 'ComputedVariableError';
  }
}
