import { ShutdownExecutor } from '../shutdown/ShutdownExecutor';
import { ShutdownTasks } from '../shutdown/ShutdownTasks';
import {
  ShutdownTask,
  ShutdownConfig,
  ShutdownState,
  ShutdownMetrics,
} from '../shutdown/types';

export class ShutdownCore {
  private shutdownTasks: ShutdownTasks;
  private executor: ShutdownExecutor;

  constructor(
    config: ShutdownConfig,
    private state: ShutdownState,
    private logCallback: (message: string) => void,
    private emitCallback: (event: string, data?: unknown) => void
  ) {
    this.shutdownTasks = new ShutdownTasks(config);
    this.executor = new ShutdownExecutor({
      config,
      state,
      shutdownTasks: this.shutdownTasks,
      logCallback,
      emitCallback,
    });
  }

  public setupDefaultTasks(): void {
    this.shutdownTasks.setupDefaultTasks();
  }

  public addTask(task: ShutdownTask): void {
    this.shutdownTasks.addTask(task);
    this.logCallback(
      `Added shutdown task: ${task.name} (priority: ${task.priority})`
    );
  }

  public removeTask(id: string): boolean {
    const task = this.shutdownTasks.getTaskById(id);
    const removed = this.shutdownTasks.removeTask(id);
    if (removed && task) {
      this.logCallback(`Removed shutdown task: ${task.name}`);
    }
    return removed;
  }

  public getTasks(): ShutdownTask[] {
    return this.shutdownTasks.getTasks();
  }

  public async executeShutdownSequence(): Promise<void> {
    await this.executor.executeShutdownTasks();
  }

  public async forceShutdown(): Promise<void> {
    await this.executor.executeShutdownTasks();
  }

  public clearAllTimeouts(): void {
    this.executor.clearAllTimeouts();
  }
}

export class ShutdownMetricsCalculator {
  public static calculate(
    state: ShutdownState,
    taskCount: number
  ): ShutdownMetrics {
    const completedCount = state.completedTasks.length;
    const failedCount = state.failedTasks.length;
    return {
      initiated: state.initiated,
      phase: state.phase,
      graceful: state.graceful,
      duration: Date.now() - state.startTime,
      totalTasks: taskCount,
      completedTasks: completedCount,
      failedTasks: failedCount,
      successRate: taskCount > 0 ? (completedCount / taskCount) * 100 : 0,
      currentTask: state.currentTask,
    };
  }
}

export class ShutdownCompletionHandler {
  constructor(
    private config: ShutdownConfig,
    private logCallback: (message: string) => void,
    private emitCallback: (event: string, data?: unknown) => void
  ) {}

  public handleCompletion(graceful: boolean, metrics: ShutdownMetrics): void {
    this.logCompletion(graceful, metrics);
    this.executeCallback(graceful);
    this.emitEvent(graceful, metrics);
  }

  private logCompletion(graceful: boolean, metrics: ShutdownMetrics): void {
    this.logCallback(
      `Shutdown ${graceful ? 'completed gracefully' : 'forced'} in ${metrics.duration}ms`
    );
    this.logCallback(
      `Tasks: ${metrics.completedTasks}/${metrics.totalTasks} completed, ${metrics.failedTasks} failed`
    );
  }

  private executeCallback(graceful: boolean): void {
    if (this.config.onShutdownComplete) {
      try {
        this.config.onShutdownComplete(graceful);
      } catch (error) {
        this.logCallback(
          `Error in shutdown complete callback: ${(error as Error).message}`
        );
      }
    }
  }

  private emitEvent(graceful: boolean, metrics: ShutdownMetrics): void {
    this.emitCallback('shutdownComplete', {
      graceful,
      duration: metrics.duration,
      completedTasks: metrics.completedTasks,
      failedTasks: metrics.failedTasks,
      totalTasks: metrics.totalTasks,
    });
  }
}

export class ShutdownSequenceManager {
  constructor(
    private state: ShutdownState,
    private core: ShutdownCore,
    private logCallback: (message: string) => void,
    private emitCallback: (event: string, data?: unknown) => void
  ) {}

  public async executeSequence(): Promise<void> {
    this.emitCallback('shutdownStart', { reason: this.state.phase });

    try {
      await this.core.executeShutdownSequence();
      this.state.phase = 'complete';
    } catch (error) {
      this.logCallback(
        `Error during shutdown sequence: ${(error as Error).message}`
      );
      throw error;
    }
  }

  public async executeForce(): Promise<void> {
    this.state.graceful = false;
    this.state.phase = 'forced';
    this.emitCallback('shutdownForced');

    try {
      await this.core.forceShutdown();
      this.state.phase = 'complete';
    } catch (error) {
      this.logCallback(
        `Error during forced shutdown: ${(error as Error).message}`
      );
      throw error;
    }
  }
}
