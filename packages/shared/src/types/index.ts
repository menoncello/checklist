export interface ChecklistTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  tags: string[];
  steps: ChecklistStep[];
  metadata: {
    createdAt: string;
    updatedAt: string;
    [key: string]: any;
  };
}

export interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  type: 'task' | 'decision' | 'group' | 'milestone';
  required: boolean;
  estimatedTime?: number;
  dependencies?: string[];
  validation?: StepValidation;
  metadata?: Record<string, any>;
  substeps?: ChecklistStep[];
}

export interface StepValidation {
  type: 'command' | 'file-exists' | 'pattern' | 'custom';
  value: string;
  expectedResult?: any;
}

export interface WorkflowState {
  version: string;
  instances: WorkflowInstance[];
  activeInstanceId: string | null;
  metadata: {
    lastModified: string;
    createdAt: string;
    [key: string]: any;
  };
}

export interface WorkflowInstance {
  id: string;
  templateId: string;
  name: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  steps: WorkflowStepState[];
  startedAt: string;
  completedAt: string | null;
  metadata: Record<string, any>;
}

export interface WorkflowStepState {
  stepId: string;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped' | 'failed';
  startedAt?: string;
  completedAt?: string;
  notes?: string;
  error?: string;
  substeps?: WorkflowStepState[];
}

export interface TerminalCapabilities {
  color: boolean;
  unicode: boolean;
  width: number;
  height: number;
  isInteractive: boolean;
}

export interface RenderOptions {
  width?: number;
  height?: number;
  color?: boolean;
  unicode?: boolean;
}

export interface ProgressInfo {
  current: number;
  total: number;
  percentage: number;
  message?: string;
  estimatedTime?: number;
}

export interface KeyBinding {
  key: string;
  modifiers?: string[];
  action: string;
  description: string;
}
