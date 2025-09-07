import { EventEmitter } from 'events';

export interface Variables {
  [key: string]: any;
}

export interface Step {
  id: string;
  title: string;
  description?: string;
  action?: string;
  condition?: string;
  validation?: StepValidation[];
  metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
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

export interface WorkflowEngineEvents {
  'step:changed': (step: Step) => void;
  'step:completed': (step: Step) => void;
  'step:skipped': (step: Step, reason?: string) => void;
  'progress:updated': (progress: Progress) => void;
  'workflow:completed': (summary: Summary) => void;
  error: (error: WorkflowError) => void;
  'state:changed': (state: WorkflowState) => void;
  'validation:failed': (step: Step, error: ValidationError) => void;
  [key: string]: (...args: any[]) => void;
}

export abstract class TypedEventEmitter<
  T extends Record<string, (...args: any[]) => void>,
> extends EventEmitter {
  emit<K extends keyof T & string>(
    event: K,
    ...args: Parameters<T[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  on<K extends keyof T & string>(event: K, listener: T[K]): this {
    return super.on(event, listener as any);
  }

  once<K extends keyof T & string>(event: K, listener: T[K]): this {
    return super.once(event, listener as any);
  }

  off<K extends keyof T & string>(event: K, listener: T[K]): this {
    return super.off(event, listener as any);
  }
}

export class WorkflowError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = false,
    public context?: Record<string, any>
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
