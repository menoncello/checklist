export interface ShutdownTask {
  id: string;
  name: string;
  priority: number;
  timeout: number;
  execute: () => Promise<void>;
  onError?: (error: Error) => void;
  critical?: boolean;
}

export interface ShutdownConfig {
  gracefulTimeout: number;
  forceTimeout: number;
  enableLogging: boolean;
  saveState: boolean;
  onShutdownStart?: () => void;
  onShutdownComplete?: (graceful: boolean) => void;
  onTaskComplete?: (task: ShutdownTask, duration: number) => void;
  onTaskError?: (task: ShutdownTask, error: Error) => void;
}

export interface ShutdownState {
  initiated: boolean;
  graceful: boolean;
  startTime: number;
  completedTasks: string[];
  failedTasks: string[];
  currentTask?: string;
  phase: 'idle' | 'graceful' | 'forced' | 'complete';
}

export interface ShutdownMetrics {
  initiated: boolean;
  phase: string;
  graceful: boolean;
  duration: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  successRate: number;
  currentTask?: string;
}

export interface EventHandler {
  (data?: unknown): void;
}

export interface TaskExecutionContext {
  task: ShutdownTask;
  startTime: number;
  duration?: number;
  error?: Error;
}
