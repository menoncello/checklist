/**
 * Variable Management System - Type Definitions
 * Core types for variable definitions, validation, and computed expressions
 */

/**
 * Supported variable types in the system
 */
export type VariableType = 'string' | 'number' | 'boolean' | 'array';

/**
 * Variable value can be primitive or nested array
 */
export type VariableValue = string | number | boolean | VariableValue[];

/**
 * Variable scope levels
 */
export type VariableScope = 'global' | 'step';

/**
 * Validation rules for variables
 */
export interface VariableValidation {
  /** Regex pattern for string validation */
  pattern?: string;
  /** Minimum value for numbers, minimum length for strings/arrays */
  min?: number;
  /** Maximum value for numbers, maximum length for strings/arrays */
  max?: number;
  /** Allowed values enumeration */
  enum?: VariableValue[];
}

/**
 * Computed expression definition with dependencies
 */
export interface ComputedExpression {
  /** Expression to evaluate */
  expression: string;
  /** Variable names this expression depends on */
  dependencies: string[];
}

/**
 * Complete variable definition
 */
export interface VariableDefinition {
  /** Variable name (unique identifier) */
  name: string;
  /** Variable type */
  type: VariableType;
  /** Whether variable is required */
  required: boolean;
  /** Default value if not provided */
  default?: VariableValue;
  /** Human-readable description */
  description: string;
  /** Validation rules */
  validation?: VariableValidation;
  /** Computed expression (mutually exclusive with default) */
  computed?: ComputedExpression;
  /** Variable scope (defaults to global) */
  scope?: VariableScope;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Additional validation details */
  details?: Record<string, unknown>;
}

/**
 * Variable state storage structure
 */
export interface VariableState {
  /** Global scope variables */
  global: Record<string, VariableValue>;
  /** Step-scoped variables (stepId -> variables) */
  steps: Record<string, Record<string, VariableValue>>;
}
