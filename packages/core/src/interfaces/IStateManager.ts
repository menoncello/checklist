export interface StateData {
  version: string;
  activeInstance?: WorkflowInstance;
  instances: WorkflowInstance[];
  config?: Record<string, unknown>;
}

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  currentStepId: string;
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  status: 'active' | 'completed' | 'paused' | 'failed';
  stepStates: Record<string, StepState>;
  metadata?: Record<string, unknown>;
}

export interface StepState {
  stepId: string;
  status: 'pending' | 'completed' | 'skipped' | 'failed';
  completedAt?: Date;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface IStateManager {
  initialize(workingDir?: string): Promise<void>;
  load(): Promise<StateData>;
  save(state: StateData): Promise<void>;
  backup(): Promise<string>;
  restore(backupPath: string): Promise<void>;
  validate(state: StateData): boolean;
  reset(): Promise<void>;
  getWorkingDirectory(): string;
  exists(): Promise<boolean>;
  lock(): Promise<void>;
  unlock(): Promise<void>;
}
