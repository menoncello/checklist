/**
 * CommandQueue - FIFO command processing with debouncing and validation
 * Prevents race conditions in navigation commands
 */

export interface QueuedCommand {
  id: string;
  execute: () => Promise<void> | void;
  validate: () => boolean;
  priority: number;
  timestamp: number;
  retries?: number;
}

export interface CommandQueueOptions {
  debounceMs?: number;
  maxQueueSize?: number;
  timeoutMs?: number;
  maxRetries?: number;
  errorHandler?: (commandId: string, key: string, error: Error) => void;
}

export interface CommandQueueStatus {
  queueSize: number;
  isProcessing: boolean;
  isPaused: boolean;
  processedCount: number;
  errorCount: number;
  averageProcessingTime: number;
  lastProcessingTime: number;
}

export class CommandQueue {
  private readonly queue: QueuedCommand[] = [];
  private readonly options: Required<CommandQueueOptions>;
  private isProcessing = false;
  private isPaused = false;
  private processingStats = {
    processedCount: 0,
    errorCount: 0,
    totalProcessingTime: 0,
    lastProcessingTime: 0,
  };
  private debounceTimer?: Timer;
  private destroyed = false;

  constructor(options: CommandQueueOptions = {}) {
    const defaults: Required<CommandQueueOptions> = {
      debounceMs: 200,
      maxQueueSize: 50,
      timeoutMs: 5000,
      maxRetries: 3,
      errorHandler: (commandId, key, error) => {
        console.error(
          `CommandQueue error for ${commandId} (${key}):`,
          error.message
        );
      },
    };
    this.options = { ...defaults, ...options };
  }

  public async enqueue(command: QueuedCommand): Promise<void> {
    if (this.destroyed) {
      throw new Error('CommandQueue has been destroyed');
    }

    if (this.queue.length >= this.options.maxQueueSize) {
      throw new Error(
        `Queue overflow: maximum size ${this.options.maxQueueSize} exceeded`
      );
    }

    // Add timestamp if not provided
    if (command.timestamp === undefined || command.timestamp === 0) {
      command.timestamp = Date.now();
    }

    // Insert command in priority order (higher priority first)
    const insertIndex = this.queue.findIndex(
      (existing) => existing.priority < command.priority
    );

    if (insertIndex === -1) {
      this.queue.push(command);
    } else {
      this.queue.splice(insertIndex, 0, command);
    }

    // Debounce processing to handle rapid key presses
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processQueue().catch((error) => {
        console.error('Queue processing error:', error);
      });
    }, this.options.debounceMs);
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.isPaused || this.destroyed) {
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0 && !this.isPaused && !this.destroyed) {
      const command = this.queue.shift();
      if (!command) continue;

      const startTime = performance.now();

      try {
        await this.executeCommand(command);
        this.processingStats.processedCount++;
      } catch (error) {
        await this.handleCommandError(command, error as Error);
      }

      const processingTime = performance.now() - startTime;
      this.processingStats.lastProcessingTime = processingTime;
      this.processingStats.totalProcessingTime += processingTime;
    }

    this.isProcessing = false;
  }

  private async executeCommand(command: QueuedCommand): Promise<void> {
    // Check command timeout
    const age = Date.now() - command.timestamp;
    const isTooOld = age > this.options.timeoutMs;
    if (isTooOld) {
      throw new Error(
        `Command '${command.id}' timed out (${age}ms > ${this.options.timeoutMs}ms)`
      );
    }

    // Validate command before execution
    if (!command.validate()) {
      throw new Error(`Command '${command.id}' validation failed`);
    }

    // Execute command with timeout protection
    let timeoutId: Timer | undefined;

    const executionPromise = Promise.resolve(command.execute());

    try {
      await Promise.race([
        executionPromise,
        new Promise<void>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`Command '${command.id}' execution timeout`));
          }, this.options.timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  private async handleCommandError(
    command: QueuedCommand,
    error: Error
  ): Promise<void> {
    // Don't retry validation or timeout errors - they will always fail
    if (this.isNonRetryableError(error)) {
      this.processingStats.errorCount++;
      this.emitError(command, error);
      return;
    }

    const retries = (command.retries ?? 0) + 1;

    if (retries <= this.options.maxRetries) {
      this.retryCommand(command, retries, error);
    } else {
      this.handleFinalFailure(command, retries, error);
    }
  }

  private isNonRetryableError(error: Error): boolean {
    return (
      error.message.includes('validation failed') ||
      error.message.includes('timed out') ||
      error.message.includes('execution timeout')
    );
  }

  private retryCommand(
    command: QueuedCommand,
    retries: number,
    error: Error
  ): void {
    const retryCommand: QueuedCommand = {
      ...command,
      retries,
      timestamp: Date.now(), // Reset timestamp for retry
    };

    // Add retry with lower priority to avoid infinite retries blocking queue
    const retryPriority = Math.max(0, command.priority - retries);
    retryCommand.priority = retryPriority;

    this.queue.push(retryCommand);

    console.warn(
      `Command '${command.id}' failed (attempt ${retries}/${this.options.maxRetries}), retrying:`,
      error.message
    );
  }

  private handleFinalFailure(
    command: QueuedCommand,
    retries: number,
    error: Error
  ): void {
    // Only count the final failure in error count
    this.processingStats.errorCount++;
    console.error(
      `Command '${command.id}' failed after ${retries} attempts:`,
      error.message
    );

    // Emit error event for external handling
    this.emitError(command, error);
  }

  private emitError(command: QueuedCommand, error: Error): void {
    // Call the error handler if provided
    if (this.options.errorHandler !== undefined) {
      // Extract the key from the command id (format: "nav-cmd-{key}")
      const key = command.id.replace('nav-cmd-', '');
      this.options.errorHandler(command.id, key, error);
    }

    console.error(`Final command failure: ${command.id}`, {
      command,
      error: error.message,
      retries: command.retries ?? 0,
    });
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;

    // Resume processing if there are queued commands
    if (this.queue.length > 0 && !this.isProcessing) {
      this.processQueue().catch((error) => {
        console.error('Queue processing error on resume:', error);
      });
    }
  }

  public clear(): void {
    this.queue.length = 0;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
  }

  public getStatus(): CommandQueueStatus {
    const averageProcessingTime =
      this.processingStats.processedCount > 0
        ? this.processingStats.totalProcessingTime /
          this.processingStats.processedCount
        : 0;

    return {
      queueSize: this.queue.length,
      isProcessing: this.isProcessing,
      isPaused: this.isPaused,
      processedCount: this.processingStats.processedCount,
      errorCount: this.processingStats.errorCount,
      averageProcessingTime,
      lastProcessingTime: this.processingStats.lastProcessingTime,
    };
  }

  public getQueuedCommands(): readonly QueuedCommand[] {
    return [...this.queue];
  }

  public hasCommand(commandId: string): boolean {
    return this.queue.some((cmd) => cmd.id === commandId);
  }

  public removeCommand(commandId: string): boolean {
    const index = this.queue.findIndex((cmd) => cmd.id === commandId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.clear();

    // Reset stats
    this.processingStats = {
      processedCount: 0,
      errorCount: 0,
      totalProcessingTime: 0,
      lastProcessingTime: 0,
    };
  }
}
