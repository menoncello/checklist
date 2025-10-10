/**
 * Variable Management System - Public API
 * Exports all public interfaces, types, and classes
 */

// Type exports
export type {
  VariableType,
  VariableValue,
  VariableScope,
  VariableValidation,
  ComputedExpression,
  VariableDefinition,
  ValidationResult,
  VariableState,
} from './types';

// Error exports
export {
  VariableError,
  VariableNotFoundError,
  VariableValidationError,
  CircularDependencyError,
  VariableSecurityError,
  InvalidVariableTypeError,
  ComputedVariableError,
} from './errors';

// Class exports
export { VariableValidator } from './VariableValidator';
export { VariableSchema } from './VariableSchema';
export { VariableStore } from './VariableStore';
export { VariableScopeManager } from './VariableScopeManager';
export { EnvironmentVariableResolver } from './EnvironmentVariableResolver';
export { ComputedVariableEngine } from './ComputedVariableEngine';
export { VariablePrompter } from './VariablePrompter';
