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

export class CleanShutdown {
  private config: ShutdownConfig;
  private shutdownTasks: ShutdownTask[] = [];
  private state: ShutdownState;
  private eventHandlers = new Map<string, Set<Function>>();
  private gracefulTimer: Timer | null = null;
  private forceTimer: Timer | null = null;
  private taskTimeouts = new Map<string, Timer>();
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

    this.setupSignalHandlers();
    this.setupDefaultTasks();
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
    // Save application state
    this.addTask({
      id: 'save-state',
      name: 'Save Application State',
      priority: 100,
      timeout: 5000,
      execute: async () => {
        if (this.config.saveState) {
          await this.saveApplicationState();
        }
      },
      critical: true,
    });

    // Close database connections
    this.addTask({
      id: 'close-connections',
      name: 'Close Database Connections',
      priority: 90,
      timeout: 10000,
      execute: async () => {
        await this.closeDatabaseConnections();
      },
    });

    // Stop timers and intervals
    this.addTask({
      id: 'stop-timers',
      name: 'Stop Timers and Intervals',
      priority: 80,
      timeout: 2000,
      execute: async () => {
        await this.stopTimersAndIntervals();
      },
    });

    // Cleanup temporary resources
    this.addTask({
      id: 'cleanup-temp',
      name: 'Cleanup Temporary Resources',
      priority: 70,
      timeout: 3000,
      execute: async () => {
        await this.cleanupTemporaryResources();
      },
    });

    // Final cleanup
    this.addTask({
      id: 'final-cleanup',
      name: 'Final Cleanup',
      priority: 10,
      timeout: 1000,
      execute: async () => {
        await this.performFinalCleanup();
      },
    });
  }

  public addTask(task: ShutdownTask): void {
    // Prevent adding tasks after shutdown has started
    if (this.state.initiated) {
      throw new Error('Cannot add tasks after shutdown has been initiated');
    }

    this.shutdownTasks.push(task);
    this.shutdownTasks.sort((a, b) => b.priority - a.priority);

    this.log(`Added shutdown task: ${task.name} (priority: ${task.priority})`);
  }

  public removeTask(id: string): boolean {
    if (this.state.initiated) {
      throw new Error('Cannot remove tasks after shutdown has been initiated');
    }

    const index = this.shutdownTasks.findIndex((task) => task.id === id);
    if (index !== -1) {
      const task = this.shutdownTasks.splice(index, 1)[0];
      this.log(`Removed shutdown task: ${task.name}`);
      return true;
    }
    return false;
  }

  public async initiate(reason: string = 'manual'): Promise<void> {
    if (this.state.initiated) {
      return this.shutdownPromise ?? Promise.resolve();
    }

    this.state.initiated = true;
    this.state.startTime = Date.now();
    this.state.phase = 'graceful';

    this.log(`Initiating shutdown: ${reason}`);
    this.emit('shutdownStart', { reason });

    // Call start callback
    if (this.config.onShutdownStart) {
      try {
        this.config.onShutdownStart();
      } catch (error) {
        this.log(
          `Error in shutdown start callback: ${(error as Error).message}`
        );
      }
    }

    // Create shutdown promise
    this.shutdownPromise = new Promise((resolve) => {
      this.resolveShutdown = resolve;
    });

    // Set up timers
    this.gracefulTimer = setTimeout(() => {
      this.log('Graceful shutdown timeout, switching to forced shutdown');
      this.forceShutdown();
    }, this.config.gracefulTimeout);

    this.forceTimer = setTimeout(() => {
      this.log('Force shutdown timeout, exiting immediately');
      this.emergencyExit();
    }, this.config.gracefulTimeout + this.config.forceTimeout);

    // Execute shutdown tasks
    await this.executeShutdownTasks();

    return this.shutdownPromise;
  }

  private async executeShutdownTasks(): Promise<void> {
    this.log(`Executing ${this.shutdownTasks.length} shutdown tasks`);

    for (const task of this.shutdownTasks) {
      if (this.state.phase === 'forced') {
        // Skip non-critical tasks during forced shutdown
        if (task.critical !== true) {
          this.log(
            `Skipping non-critical task during forced shutdown: ${task.name}`
          );
          continue;
        }
      }

      this.state.currentTask = task.id;
      await this.executeTask(task);
    }

    this.state.currentTask = undefined;
    this.completeShutdown(true);
  }

  private async executeTask(task: ShutdownTask): Promise<void> {
    const startTime = Date.now();
    this.log(`Executing task: ${task.name}`);

    try {
      // Set task timeout
      const timeoutPromise = new Promise<void>((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Task timeout: ${task.name}`));
        }, task.timeout);

        this.taskTimeouts.set(task.id, timer);
      });

      // Execute task with timeout
      await Promise.race([task.execute(), timeoutPromise]);

      // Clear timeout
      const timer = this.taskTimeouts.get(task.id);
      if (timer !== undefined) {
        clearTimeout(timer);
        this.taskTimeouts.delete(task.id);
      }

      const duration = Date.now() - startTime;
      this.state.completedTasks.push(task.id);
      this.log(`Task completed: ${task.name} (${duration}ms)`);

      // Call task complete callback
      if (this.config.onTaskComplete) {
        try {
          this.config.onTaskComplete(task, duration);
        } catch (error) {
          this.log(
            `Error in task complete callback: ${(error as Error).message}`
          );
        }
      }

      this.emit('taskComplete', { task, duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.state.failedTasks.push(task.id);
      this.log(
        `Task failed: ${task.name} (${duration}ms) - ${(error as Error).message}`
      );

      // Call task error callback
      if (task.onError) {
        try {
          task.onError(error as Error);
        } catch (callbackError) {
          this.log(
            `Error in task error callback: ${(callbackError as Error).message}`
          );
        }
      }

      // Call global task error callback
      if (this.config.onTaskError) {
        try {
          this.config.onTaskError(task, error as Error);
        } catch (callbackError) {
          this.log(
            `Error in global task error callback: ${(callbackError as Error).message}`
          );
        }
      }

      this.emit('taskError', { task, error, duration });

      // If it's a critical task and we're in graceful shutdown, switch to forced
      if (task.critical === true && this.state.phase === 'graceful') {
        this.log(
          `Critical task failed, switching to forced shutdown: ${task.name}`
        );
        this.forceShutdown();
      }
    }
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

    this.state.phase = 'complete';
    this.state.graceful = graceful;

    const duration = Date.now() - this.state.startTime;
    const completed = this.state.completedTasks.length;
    const failed = this.state.failedTasks.length;
    const total = this.shutdownTasks.length;

    this.log(
      `Shutdown ${graceful ? 'completed gracefully' : 'forced'} in ${duration}ms`
    );
    this.log(`Tasks: ${completed}/${total} completed, ${failed} failed`);

    // Clear timers
    this.cleanup();

    // Call completion callback
    if (this.config.onShutdownComplete) {
      try {
        this.config.onShutdownComplete(graceful);
      } catch (error) {
        this.log(
          `Error in shutdown complete callback: ${(error as Error).message}`
        );
      }
    }

    this.emit('shutdownComplete', {
      graceful,
      duration,
      completed,
      failed,
      total,
    });

    // Resolve shutdown promise
    if (this.resolveShutdown !== null) {
      this.resolveShutdown();
    }

    // Exit process
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
    for (const timer of this.taskTimeouts.values()) {
      clearTimeout(timer);
    }
    this.taskTimeouts.clear();
  }

  // Default task implementations
  private async saveApplicationState(): Promise<void> {
    // This would save actual application state
    this.log('Saving application state');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async closeDatabaseConnections(): Promise<void> {
    // This would close actual database connections
    this.log('Closing database connections');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  private async stopTimersAndIntervals(): Promise<void> {
    // This would stop actual timers and intervals
    this.log('Stopping timers and intervals');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async cleanupTemporaryResources(): Promise<void> {
    // This would clean up temporary files, caches, etc.
    this.log('Cleaning up temporary resources');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  private async performFinalCleanup(): Promise<void> {
    // This would perform final cleanup tasks
    this.log('Performing final cleanup');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // Public interface
  public isShuttingDown(): boolean {
    return this.state.initiated;
  }

  public getState(): ShutdownState {
    return { ...this.state };
  }

  public getTasks(): ShutdownTask[] {
    return [...this.shutdownTasks];
  }

  public getMetrics(): ShutdownMetrics {
    const total = this.shutdownTasks.length;
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

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers !== undefined) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: Function): void {
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
