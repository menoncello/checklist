import type { WorkflowInstance } from './IStateManager';

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  steps: WorkflowStep[];
  metadata?: Record<string, unknown>;
}

export interface WorkflowStep {
  id: string;
  name: string;
  description?: string;
  type: 'task' | 'decision' | 'parallel' | 'loop';
  conditions?: StepCondition[];
  next?: string | string[];
  metadata?: Record<string, unknown>;
}

export interface StepCondition {
  type: 'required' | 'optional' | 'skipIf' | 'continueIf';
  expression: string;
  value?: unknown;
}

export interface WorkflowEvent {
  type:
    | 'step-started'
    | 'step-completed'
    | 'step-skipped'
    | 'step-failed'
    | 'workflow-started'
    | 'workflow-completed'
    | 'workflow-paused'
    | 'workflow-failed';
  workflowId: string;
  instanceId: string;
  stepId?: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

export type WorkflowEventHandler = (
  event: WorkflowEvent
) => void | Promise<void>;

export interface IWorkflowEngine {
  loadWorkflow(definition: WorkflowDefinition): Promise<void>;
  startWorkflow(workflowId: string): Promise<WorkflowInstance>;
  getCurrentStep(): WorkflowStep | null;
  advance(): Promise<void>;
  goBack(): Promise<void>;
  skip(): Promise<void>;
  reset(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  getStatus(): 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  getInstance(): WorkflowInstance | null;
  on(event: WorkflowEvent['type'], handler: WorkflowEventHandler): void;
  off(event: WorkflowEvent['type'], handler: WorkflowEventHandler): void;
  emit(event: WorkflowEvent): Promise<void>;
}
