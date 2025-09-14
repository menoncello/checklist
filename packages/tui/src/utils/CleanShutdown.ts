import { ShutdownExecutor } from '../shutdown/ShutdownExecutor.js';
import { ShutdownTasks } from '../shutdown/ShutdownTasks.js';
import {
  ShutdownTask,
  ShutdownConfig,
  ShutdownState,
  ShutdownMetrics,
  EventHandler,
} from '../shutdown/types.js';

export class CleanShutdown {
  private config: ShutdownConfig;
  private state: ShutdownState;
  private shutdownTasks: ShutdownTasks;
  private executor: ShutdownExecutor;
  private eventHandlers = new Map<string, Set<EventHandler>>();
  private gracefulTimer: NodeJS.Timeout | null = null;
  private forceTimer: NodeJS.Timeout | null = null;
  private shutdownPromise: Promise<void> | null = null;
  private resolveShutdown: (() => void) | null = null;

  constructor(config: Partial<ShutdownConfig> = {}) {
    this.config = {
      gracefulTimeout: 30000, // 30 seconds
      forceTimeout: 5000, // 5 seconds after graceful timeout
      enableLogging: true,
      saveState: true,
      ...config,
    };

    this.state = {
      initiated: false,
      graceful: false,
      startTime: 0,
      completedTasks: [],
      failedTasks: [],
      phase: 'idle',
    };

    this.shutdownTasks = new ShutdownTasks(this.config);
    this.executor = new ShutdownExecutor({
      config: this.config,
      state: this.state,
      shutdownTasks: this.shutdownTasks,
      logCallback: (message: string) => this.log(message),
      emitCallback: (event: string, data?: unknown) => this.emit(event, data)
    });

    this.setupSignalHandlers();
    this.setupDefaultTasks();
    this.setupExecutorListeners();
  }

  private setupSignalHandlers(): void {
    // Graceful shutdown signals
    process.on('SIGTERM', () => {
      this.log('Received SIGTERM, initiating graceful shutdown');
      this.initiate('SIGTERM');
    });

    process.on('SIGINT', () => {
      this.log('Received SIGINT, initiating graceful shutdown');
      this.initiate('SIGINT');
    });

    // Force shutdown signal
    process.on('SIGKILL', () => {
      this.log('Received SIGKILL, forcing immediate shutdown');
      this.forceShutdown();
    });

    // Handle uncaught exceptions during shutdown
    process.on('uncaughtException', (error) => {
      if (this.state.initiated) {
        this.log(`Uncaught exception during shutdown: ${error.message}`);
        this.forceShutdown();
      }
    });

    // Handle unhandled promise rejections during shutdown
    process.on('unhandledRejection', (reason) => {
      if (this.state.initiated) {
        this.log(`Unhandled promise rejection during shutdown: ${reason}`);
      }
    });
  }

  private setupDefaultTasks(): void {
    this.shutdownTasks.setupDefaultTasks();
  }

  private setupExecutorListeners(): void {
    this.on('requestForcedShutdown', () => {
      this.forceShutdown();
    });
  }

  public addTask(task: ShutdownTask): void {
    if (this.state.initiated) {
      throw new Error('Cannot add tasks after shutdown has been initiated');
    }

    this.shutdownTasks.addTask(task);
    this.log(`Added shutdown task: ${task.name} (priority: ${task.priority})`);
  }

  public removeTask(id: string): boolean {
    if (this.state.initiated) {
      throw new Error('Cannot remove tasks after shutdown has been initiated');
    }

    const task = this.shutdownTasks.getTaskById(id);
    const removed = this.shutdownTasks.removeTask(id);

    if (removed && task) {
      this.log(`Removed shutdown task: ${task.name}`);
    }

    return removed;
  }

  public async initiate(reason: string = 'manual'): Promise<void> {
    if (this.isAlreadyShuttingDown()) {
      return this.shutdownPromise ?? Promise.resolve();
    }

    this.initializeShutdownState(reason);
    this.executeStartCallback();
    this.setupShutdownPromise();
    this.setupShutdownTimers();

    await this.executeShutdownSequence();

    return this.shutdownPromise;
  }


  /**
   * Check if shutdown is already in progress
   */
  private isAlreadyShuttingDown(): boolean {
    return this.state.initiated;
  }

  /**
   * Initialize shutdown state
   */
  private initializeShutdownState(reason: string): void {
    this.state.initiated = true;
    this.state.startTime = Date.now();
    this.state.phase = 'graceful';

    this.log(`Initiating shutdown: ${reason}`);
    this.emit('shutdownStart', { reason });
  }

  /**
   * Execute start callback if configured
   */
  private executeStartCallback(): void {
    if (this.config.onShutdownStart) {
      try {
        this.config.onShutdownStart();
      } catch (error) {
        this.log(
          `Error in shutdown start callback: ${(error as Error).message}`
        );
      }
    }
  }

  /**
   * Setup shutdown promise for async coordination
   */
  private setupShutdownPromise(): void {
    this.shutdownPromise = new Promise((resolve) => {
      this.resolveShutdown = resolve;
    });
  }

  /**
   * Setup shutdown timeout timers
   */
  private setupShutdownTimers(): void {
    this.gracefulTimer = setTimeout(() => {
      this.log('Graceful shutdown timeout, switching to forced shutdown');
      this.forceShutdown();
    }, this.config.gracefulTimeout);

    this.forceTimer = setTimeout(() => {
      this.log('Force shutdown timeout, exiting immediately');
      this.emergencyExit();
    }, this.config.gracefulTimeout + this.config.forceTimeout);
  }

  /**
   * Execute the main shutdown sequence
   */
  private async executeShutdownSequence(): Promise<void> {
    await this.executor.executeShutdownTasks();
    this.completeShutdown(true);
  }

  private forceShutdown(): void {
    if (this.state.phase === 'forced' || this.state.phase === 'complete') {
      return;
    }

    this.state.phase = 'forced';
    this.log('Switching to forced shutdown');
    this.emit('forcedShutdown');

    // Cancel remaining non-critical tasks and execute only critical ones
    // The main execution loop will handle this based on the phase change
  }

  private emergencyExit(): void {
    this.log('Emergency exit - immediate termination');
    this.emit('emergencyExit');

    this.cleanup();
    process.exit(1);
  }

  private completeShutdown(graceful: boolean): void {
    if (this.state.phase === 'complete') {
      return;
    }

    this.updateShutdownState(graceful);
    const metrics = this.calculateShutdownMetrics();
    this.logShutdownCompletion(graceful, metrics);
    this.cleanup();
    this.executeCompletionCallback(graceful);
    this.emitCompletionEvent(graceful, metrics);
    this.resolveShutdownPromise();
    this.scheduleProcessExit(graceful);
  }

  private updateShutdownState(graceful: boolean): void {
    this.state.phase = 'complete';
    this.state.graceful = graceful;
  }

  private calculateShutdownMetrics(): { duration: number; completed: number; failed: number; total: number } {
    return {
      duration: Date.now() - this.state.startTime,
      completed: this.state.completedTasks.length,
      failed: this.state.failedTasks.length,
      total: this.shutdownTasks.getTasks().length,
    };
  }

  private logShutdownCompletion(graceful: boolean, metrics: { duration: number; completed: number; failed: number; total: number }): void {
    this.log(
      `Shutdown ${graceful ? 'completed gracefully' : 'forced'} in ${metrics.duration}ms`
    );
    this.log(`Tasks: ${metrics.completed}/${metrics.total} completed, ${metrics.failed} failed`);
  }

  private executeCompletionCallback(graceful: boolean): void {
    if (this.config.onShutdownComplete) {
      try {
        this.config.onShutdownComplete(graceful);
      } catch (error) {
        this.log(
          `Error in shutdown complete callback: ${(error as Error).message}`
        );
      }
    }
  }

  private emitCompletionEvent(graceful: boolean, metrics: { duration: number; completed: number; failed: number; total: number }): void {
    this.emit('shutdownComplete', {
      graceful,
      duration: metrics.duration,
      completed: metrics.completed,
      failed: metrics.failed,
      total: metrics.total,
    });
  }

  private resolveShutdownPromise(): void {
    if (this.resolveShutdown !== null) {
      this.resolveShutdown();
    }
  }

  private scheduleProcessExit(graceful: boolean): void {
    setTimeout(() => {
      process.exit(graceful ? 0 : 1);
    }, 100);
  }

  private cleanup(): void {
    if (this.gracefulTimer !== null) {
      clearTimeout(this.gracefulTimer);
      this.gracefulTimer = null;
    }

    if (this.forceTimer !== null) {
      clearTimeout(this.forceTimer);
      this.forceTimer = null;
    }

    // Clear all task timeouts
    this.executor.clearAllTimeouts();
  }


  // Public interface
  public isShuttingDown(): boolean {
    return this.state.initiated;
  }

  public getState(): ShutdownState {
    return { ...this.state };
  }

  public getTasks(): ShutdownTask[] {
    return this.shutdownTasks.getTasks();
  }

  public getMetrics(): ShutdownMetrics {
    const tasks = this.shutdownTasks.getTasks();
    const total = tasks.length;
    const completed = this.state.completedTasks.length;
    const failed = this.state.failedTasks.length;
    const duration =
      this.state.startTime > 0 ? Date.now() - this.state.startTime : 0;

    return {
      initiated: this.state.initiated,
      phase: this.state.phase,
      graceful: this.state.graceful,
      duration,
      totalTasks: total,
      completedTasks: completed,
      failedTasks: failed,
      successRate: total > 0 ? (completed / total) * 100 : 0,
      currentTask: this.state.currentTask,
    };
  }

  public updateConfig(newConfig: Partial<ShutdownConfig>): void {
    if (this.state.initiated) {
      throw new Error(
        'Cannot update configuration after shutdown has been initiated'
      );
    }
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): ShutdownConfig {
    return { ...this.config };
  }

  private log(message: string): void {
    if (this.config.enableLogging) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] CleanShutdown: ${message}`);
    }
  }

  public on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers !== undefined) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers !== undefined) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers !== undefined) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (_error) {
          this.log(
            `Error in shutdown event handler for '${event}': ${(_error as Error).message}`
          );
        }
      });
    }
  }
}

// Re-export types for convenience
export type {
  ShutdownTask,
  ShutdownConfig,
  ShutdownState,
  ShutdownMetrics,
} from '../shutdown/types.js';
