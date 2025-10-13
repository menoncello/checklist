import { EventEmitter } from 'events';

export interface Variables {
  [key: string]: unknown;
}

/**
 * Represents a single step in a workflow with optional conditional visibility
 *
 * @example
 * // Simple step with no condition - always visible
 * const step1: Step = {
 *   id: 'setup',
 *   title: 'Setup environment',
 *   description: 'Initialize the project'
 * };
 *
 * @example
 * // Step with simple condition
 * const step2: Step = {
 *   id: 'deploy',
 *   title: 'Deploy to production',
 *   condition: 'environment === "production"'
 * };
 *
 * @example
 * // Step with complex condition (AND/OR/NOT)
 * const step3: Step = {
 *   id: 'notify',
 *   title: 'Send notification',
 *   condition: '(count > 10 && status === "active") || priority === "urgent"'
 * };
 *
 * @example
 * // Step in a conditional group
 * const step4: Step = {
 *   id: 'advanced-setup',
 *   title: 'Advanced setup',
 *   groupId: 'advanced-features',
 *   groupCondition: 'advancedMode === true',
 *   condition: 'hasPermission === true'
 * };
 */
export interface Step {
  id: string;
  title: string;
  description?: string;
  action?: string;

  /**
   * Conditional visibility expression. When present, the step is only visible
   * if the condition evaluates to true. Supports comparison operators
   * (==, !=, >, <, >=, <=) and logical operators (&&, ||, !).
   *
   * @example 'count > 10'
   * @example 'status === "active" && priority === "high"'
   * @example '!completed || retry === true'
   */
  condition?: string;

  /**
   * Result of the last condition evaluation. Cached for performance.
   * - undefined: condition not yet evaluated
   * - true: step is visible
   * - false: step is hidden
   */
  conditionResult?: boolean;

  /**
   * Timestamp (milliseconds since epoch) when the condition was last evaluated.
   * Used for cache invalidation and debugging.
   */
  conditionEvaluatedAt?: number;

  /**
   * Optional group identifier. Steps with the same groupId can share a
   * group-level condition via groupCondition.
   */
  groupId?: string;

  /**
   * Group-level condition expression. If present and false, ALL steps
   * in the group are hidden, regardless of individual step conditions.
   * Evaluated before individual step conditions.
   *
   * @example 'featureEnabled === true'
   */
  groupCondition?: string;

  validation?: StepValidation[];
  metadata?: Record<string, unknown>;
}

export interface StepValidation {
  type: 'command' | 'file_exists' | 'custom';
  check: string;
  errorMessage?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface StepResult {
  success: boolean;
  step: Step | null;
  error?: string;
}

export interface CompletedStep {
  step: Step;
  completedAt: Date;
  duration?: number;
}

export interface SkippedStep {
  step: Step;
  reason?: string;
  timestamp: Date;
}

export interface WorkflowState {
  status: 'idle' | 'active' | 'paused' | 'completed' | 'failed';
  currentStepIndex: number;
  currentStep?: Step;
  completedSteps: CompletedStep[];
  skippedSteps: SkippedStep[];
  variables: Variables;
  startedAt?: Date;
  completedAt?: Date;
  pausedAt?: Date;
  templateId?: string;
  instanceId?: string;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  description?: string;
  version?: string;
  steps: Step[];
  variables?: Variables;
  metadata?: Record<string, unknown>;
}

export interface Progress {
  currentStepIndex: number;
  totalSteps: number;
  completedSteps: number;
  skippedSteps: number;
  percentComplete: number;
  estimatedTimeRemaining?: number;
}

export interface Summary {
  templateId: string;
  instanceId: string;
  startedAt: Date;
  completedAt: Date;
  duration: number;
  completedSteps: number;
  skippedSteps: number;
  totalSteps: number;
  status: 'completed' | 'failed';
}

export interface StepContext {
  step: Step;
  state: WorkflowState;
  variables: Variables;
}

export type StepValidator = (
  step: Step,
  context: StepContext
) => Promise<ValidationResult>;
export type ConditionEvaluator = (
  condition: string,
  context: StepContext
) => boolean;

export type WorkflowEngineEvents = {
  'step:changed': (step: Step) => void;
  'step:completed': (step: Step) => void;
  'step:skipped': (step: Step, reason?: string) => void;
  'progress:updated': (progress: Progress) => void;
  'workflow:completed': (summary: Summary) => void;
  error: (error: WorkflowError) => void;
  'state:changed': (state: WorkflowState) => void;
  'validation:failed': (step: Step, error: ValidationError) => void;
  'recovery:started': (data: { type: string; timestamp: Date }) => void;
  'recovery:completed': (data: {
    type: string;
    timestamp: Date;
    recoveredCount: number;
  }) => void;
} & Record<string, (...args: unknown[]) => void>;

export abstract class TypedEventEmitter<
  T extends Record<string, (...args: unknown[]) => void>,
> extends EventEmitter {
  emit<K extends keyof T & string>(
    event: K,
    ...args: Parameters<T[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  on<K extends keyof T & string>(event: K, listener: T[K]): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  once<K extends keyof T & string>(event: K, listener: T[K]): this {
    return super.once(event, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof T & string>(event: K, listener: T[K]): this {
    return super.off(event, listener as (...args: unknown[]) => void);
  }
}

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

/**
 * Context for evaluating step conditions
 */
export interface ConditionalEvaluationContext {
  /** All variables available for condition evaluation */
  variables: Variables;
  /** Optional step ID for scoped variable resolution */
  stepId?: string;
  /** Current workflow state */
  workflowState: WorkflowState;
  /** Timestamp when evaluation was requested */
  timestamp: number;
}

/**
 * Result of a condition evaluation with performance metrics
 */
export interface ConditionEvaluationResult {
  /** Step ID that was evaluated */
  stepId: string;
  /** Condition expression that was evaluated */
  condition: string;
  /** Boolean result of the evaluation */
  result: boolean;
  /** Time taken to evaluate in milliseconds */
  evaluationTime: number;
  /** Variable names used in the condition */
  variablesUsed: string[];
  /** Whether this result came from cache */
  cached: boolean;
}

/**
 * Debug report for a step's condition evaluation
 */
export interface ConditionDebugReport {
  /** Step ID */
  stepId: string;
  /** Step title for display */
  stepTitle: string;
  /** Condition expression (undefined if no condition) */
  condition: string | undefined;
  /** Evaluation result (true = visible, false = hidden) */
  result: boolean;
  /** Variable values used in condition evaluation */
  variablesUsed: Variables;
  /** Time since last evaluation in milliseconds */
  evaluationTime: number;
  /** Human-readable explanation of why step is hidden/visible */
  reason: string;
}

/**
 * Group of steps that share a common condition
 */
export interface StepGroup {
  /** Unique group identifier */
  id: string;
  /** Optional group-level condition */
  condition?: string;
  /** Step IDs belonging to this group */
  stepIds: string[];
  /** Cached result of group condition evaluation */
  conditionResult?: boolean;
}
