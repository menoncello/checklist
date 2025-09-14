import { ShutdownTasks } from './ShutdownTasks.js';
import { ShutdownTask, ShutdownConfig, ShutdownState, TaskExecutionContext } from './types.js';

interface ShutdownExecutorConfig {
  config: ShutdownConfig;
  state: ShutdownState;
  shutdownTasks: ShutdownTasks;
  logCallback: (message: string) => void;
  emitCallback: (event: string, data?: unknown) => void;
}

export class ShutdownExecutor {
  private config: ShutdownConfig;
  private state: ShutdownState;
  private shutdownTasks: ShutdownTasks;
  private taskTimeouts = new Map<string, NodeJS.Timeout>();
  private logCallback: (message: string) => void;
  private emitCallback: (event: string, data?: unknown) => void;

  constructor(executorConfig: ShutdownExecutorConfig) {
    this.config = executorConfig.config;
    this.state = executorConfig.state;
    this.shutdownTasks = executorConfig.shutdownTasks;
    this.logCallback = executorConfig.logCallback;
    this.emitCallback = executorConfig.emitCallback;
  }

  public async executeShutdownTasks(): Promise<void> {
    const tasks = this.shutdownTasks.getTasks();
    this.logCallback(`Executing ${tasks.length} shutdown tasks`);

    for (const task of tasks) {
      if (this.shouldSkipTask(task)) {
        continue;
      }

      this.state.currentTask = task.id;
      await this.executeTask(task);
    }

    this.state.currentTask = undefined;
  }

  private shouldSkipTask(task: ShutdownTask): boolean {
    if (this.state.phase === 'forced' && task.critical !== true) {
      this.logCallback(
        `Skipping non-critical task during forced shutdown: ${task.name}`
      );
      return true;
    }
    return false;
  }

  public async executeTask(task: ShutdownTask): Promise<void> {
    const context = this.createExecutionContext(task);
    this.logCallback(`Executing task: ${task.name}`);

    try {
      await this.runTaskWithTimeout(task);
      this.handleTaskSuccess(task, context);
    } catch (error) {
      this.handleTaskFailure(task, context, error as Error);
    }
  }

  private createExecutionContext(task: ShutdownTask): TaskExecutionContext {
    return {
      task,
      startTime: Date.now(),
    };
  }

  private async runTaskWithTimeout(task: ShutdownTask): Promise<void> {
    const timeoutPromise = this.createTimeoutPromise(task);
    await Promise.race([task.execute(), timeoutPromise]);
    this.clearTaskTimeout(task);
  }

  private createTimeoutPromise(task: ShutdownTask): Promise<never> {
    return new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Task timeout: ${task.name}`));
      }, task.timeout);

      this.taskTimeouts.set(task.id, timer);
    });
  }

  private clearTaskTimeout(task: ShutdownTask): void {
    const timer = this.taskTimeouts.get(task.id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.taskTimeouts.delete(task.id);
    }
  }

  private handleTaskSuccess(task: ShutdownTask, context: TaskExecutionContext): void {
    const duration = Date.now() - context.startTime;
    this.state.completedTasks.push(task.id);
    this.logCallback(`Task completed: ${task.name} (${duration}ms)`);

    this.invokeTaskCompleteCallback(task, duration);
    this.emitCallback('taskComplete', { task, duration });
  }

  private handleTaskFailure(task: ShutdownTask, context: TaskExecutionContext, error: Error): void {
    const duration = Date.now() - context.startTime;
    this.state.failedTasks.push(task.id);
    this.logCallback(
      `Task failed: ${task.name} (${duration}ms) - ${error.message}`
    );

    this.invokeTaskErrorCallbacks(task, error);
    this.emitCallback('taskError', { task, error, duration });

    this.handleCriticalTaskFailure(task);
  }

  private invokeTaskCompleteCallback(task: ShutdownTask, duration: number): void {
    if (this.config.onTaskComplete) {
      try {
        this.config.onTaskComplete(task, duration);
      } catch (error) {
        this.logCallback(
          `Error in task complete callback: ${(error as Error).message}`
        );
      }
    }
  }

  private invokeTaskErrorCallbacks(task: ShutdownTask, error: Error): void {
    // Task-specific error callback
    if (task.onError) {
      try {
        task.onError(error);
      } catch (callbackError) {
        this.logCallback(
          `Error in task error callback: ${(callbackError as Error).message}`
        );
      }
    }

    // Global task error callback
    if (this.config.onTaskError) {
      try {
        this.config.onTaskError(task, error);
      } catch (callbackError) {
        this.logCallback(
          `Error in global task error callback: ${(callbackError as Error).message}`
        );
      }
    }
  }

  private handleCriticalTaskFailure(task: ShutdownTask): void {
    if (task.critical === true && this.state.phase === 'graceful') {
      this.logCallback(
        `Critical task failed, switching to forced shutdown: ${task.name}`
      );
      this.requestForcedShutdown();
    }
  }

  private requestForcedShutdown(): void {
    // This would trigger forced shutdown in the main class
    this.emitCallback('requestForcedShutdown');
  }

  public clearAllTimeouts(): void {
    for (const timer of this.taskTimeouts.values()) {
      clearTimeout(timer);
    }
    this.taskTimeouts.clear();
  }

  public getActiveTimeouts(): string[] {
    return Array.from(this.taskTimeouts.keys());
  }
}