export const version = '0.0.1';

// Export state management modules
export { StateManager } from './state/StateManager';
export { DirectoryManager } from './state/DirectoryManager';
export { ConcurrencyManager } from './state/ConcurrencyManager';
export { TransactionCoordinator } from './state/TransactionCoordinator';
export { BackupManager } from './state/BackupManager';
export * from './state/constants';

// Export workflow engine modules
export { WorkflowEngine } from './workflow/WorkflowEngine';
export { safeEval } from './workflow/conditions';
export { validateStep } from './workflow/validators';

// Re-export types and errors with explicit names to avoid conflicts
export {
  // State types
  ChecklistState,
  Operation,
  Transaction,
  BackupManifest,
  Recovery,
  Conflicts,
  CompletedStep as StateCompletedStep,
  ActiveInstance,
  CommandResult,
  StepResult as StateStepResult,
  WorkflowStatus,
  CorruptionType,
  RecoveryMethod,
  ConflictResolution,
  OperationType,
  TransactionStatus,
} from './state/types';

export {
  // State errors
  StateError,
  StateCorruptedError,
  RecoveryError,
  TransactionError,
} from './state/errors';

export {
  // Workflow types
  Variables,
  Step,
  StepValidation,
  ValidationResult,
  StepResult,
  CompletedStep,
  SkippedStep,
  WorkflowState,
  ChecklistTemplate,
  Progress,
  Summary,
  StepContext,
  StepValidator,
  ConditionEvaluator,
  WorkflowEngineEvents,
} from './workflow/types';

export {
  // Workflow errors
  WorkflowError,
  StateTransitionError,
  ValidationError,
  ConditionEvaluationError,
  StateCorruptionError,
  TemplateLoadError,
} from './workflow/errors';
