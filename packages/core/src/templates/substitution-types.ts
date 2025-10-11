/**
 * Variable Substitution System - Type Definitions
 * Types for variable substitution, configuration, and results
 */

import type { VariableValue } from '../variables/types';

/**
 * Substitution configuration options
 */
export interface SubstitutionConfig {
  /** Maximum nesting depth for nested variables (default: 5) */
  maxNestingDepth: number;
  /** Allow undefined variables without throwing errors (default: false) */
  allowUndefinedVariables: boolean;
  /** Enable default value syntax ${var:-default} (default: true) */
  useDefaultValues: boolean;
  /** Enable result caching for repeated templates (default: true) */
  enableCaching: boolean;
  /** Escape pattern for literal ${...} (default: '\\') */
  escapePattern: string;
}

/**
 * Substitution context with variables and config
 */
export interface SubstitutionContext {
  /** Available variables for substitution */
  variables: Record<string, VariableValue>;
  /** Optional step ID for scoped variable resolution */
  stepId?: string;
  /** Substitution configuration */
  config: SubstitutionConfig;
}

/**
 * Individual substitution error
 */
export interface SubstitutionError {
  /** Variable name that caused the error */
  variableName: string;
  /** Error message */
  message: string;
  /** Suggested variable names (for typos) */
  suggestions?: string[];
}

/**
 * Substitution result with metadata
 */
export interface SubstitutionResult {
  /** Substituted output string */
  output: string;
  /** List of variables used in substitution */
  variablesUsed: string[];
  /** Errors encountered during substitution */
  errors: SubstitutionError[];
  /** Performance and usage metadata */
  metadata: SubstitutionMetadata;
}

/**
 * Metadata about substitution execution
 */
export interface SubstitutionMetadata {
  /** Duration in milliseconds */
  duration: number;
  /** Number of variables substituted */
  variableCount: number;
  /** Maximum nesting depth encountered */
  nestingDepth: number;
}

/**
 * Variable position in template for preview
 */
export interface VariablePosition {
  /** Start index in template string */
  start: number;
  /** End index in template string */
  end: number;
}

/**
 * Variable information for preview
 */
export interface VariablePreview {
  /** Variable name */
  name: string;
  /** Variable value */
  value: VariableValue;
  /** Position in template */
  position: VariablePosition;
  /** Whether to highlight in output */
  highlighted: boolean;
}

/**
 * Substitution preview result
 */
export interface SubstitutionPreview {
  /** Original template string */
  original: string;
  /** Substituted output string */
  substituted: string;
  /** Variables found in template with positions */
  variables: VariablePreview[];
}
