/**
 * Advanced Template Features - Type Definitions
 * Types for conditionals, loops, functions, and math expressions
 */

import type { VariableValue } from '../variables/types';

/**
 * Template evaluation context
 */
export interface EvaluationContext {
  variables: Record<string, VariableValue>;
  stepId?: string;
  loopContext?: LoopContext;
  nestingDepth: number;
  maxNestingDepth: number;
  performanceMetrics: PerformanceMetrics;
}

/**
 * Loop context for iteration tracking
 */
export interface LoopContext {
  items: unknown[];
  index: number;
  key?: string;
  first: boolean;
  last: boolean;
  parent?: LoopContext;
}

/**
 * Performance tracking metrics
 */
export interface PerformanceMetrics {
  startTime: number;
  evaluations: number;
  maxExecutionTime: number;
}

/**
 * Conditional block structure
 */
export interface ConditionalBlock {
  type: 'if' | 'else-if' | 'else';
  condition?: string;
  content: string;
  startPos: number;
  endPos: number;
}

/**
 * Conditional evaluation result
 */
export interface ConditionalResult {
  output: string;
  conditionsMet: number;
  evaluationTime: number;
}

/**
 * Loop block structure
 */
export interface LoopBlock {
  items: string;
  content: string;
  startPos: number;
  endPos: number;
}

/**
 * Loop evaluation result
 */
export interface LoopResult {
  output: string;
  iterations: number;
  evaluationTime: number;
  limitReached: boolean;
}

/**
 * Template function definition
 */
export interface TemplateFunction {
  name: string;
  execute: (args: unknown[], context: EvaluationContext) => unknown;
  validate: (args: unknown[]) => boolean;
  safe: boolean;
}

/**
 * Function registry interface
 */
export interface FunctionRegistry {
  register(name: string, fn: TemplateFunction): void;
  get(name: string): TemplateFunction | undefined;
  has(name: string): boolean;
  list(): string[];
}

/**
 * Math expression structure
 */
export interface MathExpression {
  expression: string;
  variables: string[];
  operators: string[];
  valid: boolean;
}

/**
 * Math evaluation result
 */
export interface MathResult {
  value: number;
  expression: string;
  evaluationTime: number;
}
