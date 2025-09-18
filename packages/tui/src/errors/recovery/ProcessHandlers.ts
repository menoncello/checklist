export class ProcessHandlers {
  private processHandlerRefs = new Map<string, Function>();
  private disableProcessHandlers: boolean;
  private shutdownInProgress = false;
  private gracefulShutdownTimeout: number;
  private emergencyHandlers = new Set<() => void>();
  private onCrashCallback?: (reason: string, error?: Error) => void;
  private crashRecoveryInstance?: unknown;
  private onSignalCallback?: (signal: string) => void;
  private onWarningCallback?: (warning: Error) => void;

  constructor(
    gracefulShutdownTimeout: number = 5000,
    disableProcessHandlers: boolean = false,
    onCrashCallback?: (reason: string, error?: Error) => void,
    crashRecoveryInstance?: unknown
  ) {
    this.gracefulShutdownTimeout = gracefulShutdownTimeout;
    this.disableProcessHandlers = disableProcessHandlers;
    this.onCrashCallback = onCrashCallback;
    this.crashRecoveryInstance = crashRecoveryInstance;

    if (!this.disableProcessHandlers) {
      this.setupProcessHandlers();
    }
  }

  private setupProcessHandlers(): void {
    this.registerSignalHandlers();
    this.registerExceptionHandlers();
    this.registerWarningHandler();
  }

  private registerSignalHandlers(): void {
    const handleExit = this.createExitHandler();
    const handleSignal = this.createSignalHandler();

    // Store references and register signal handlers
    const signals = ['SIGINT', 'SIGTERM', 'SIGUSR2'];
    signals.forEach((signal) => {
      this.processHandlerRefs.set(signal, handleSignal);
      process.on(signal as NodeJS.Signals, handleSignal);
    });

    // Register exit handlers
    const exitEvents = ['exit', 'beforeExit'];
    exitEvents.forEach((event) => {
      this.processHandlerRefs.set(event, handleExit);
      process.on(event as 'exit' | 'beforeExit', handleExit);
    });
  }

  private registerExceptionHandlers(): void {
    const handleUncaughtException = (error: Error): void => {
      this.handleProcessCrash('Uncaught Exception', error);
    };

    const handleUnhandledRejection = (
      reason: unknown,
      _promise: Promise<unknown>
    ): void => {
      const error =
        reason instanceof Error ? reason : new Error(String(reason));
      this.handleProcessCrash('Unhandled Promise Rejection', error);
    };

    this.processHandlerRefs.set('uncaughtException', handleUncaughtException);
    this.processHandlerRefs.set('unhandledRejection', handleUnhandledRejection);

    process.on('uncaughtException', handleUncaughtException);
    process.on('unhandledRejection', handleUnhandledRejection);
  }

  private registerWarningHandler(): void {
    const handleWarning = (warning: Error): void => {
      console.warn('Process warning:', warning);
      if (this.onWarningCallback) {
        this.onWarningCallback(warning);
      }
    };

    this.processHandlerRefs.set('warning', handleWarning);
    process.on('warning', handleWarning);
  }

  private createExitHandler(): () => void {
    return (): void => {
      if (!this.shutdownInProgress) {
        this.initiateGracefulShutdown();
      }
    };
  }

  private createSignalHandler(): (signal: string) => void {
    return (signal: string): void => {
      console.log(`\nReceived ${signal}. Initiating graceful shutdown...`);
      // Only use the callback - it should be set up by CrashRecovery
      if (this.onSignalCallback) {
        this.onSignalCallback(signal);
      }
    };
  }

  public setOnSignalHandler(callback: (signal: string) => void): void {
    this.onSignalCallback = callback;
  }

  public setOnWarningHandler(callback: (warning: Error) => void): void {
    this.onWarningCallback = callback;
  }

  private handleProcessCrash(reason: string, error: Error): void {
    console.error('Process crash detected:', {
      reason,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    // Run emergency handlers
    this.runEmergencyHandlers();

    // Call crash callback if provided
    if (this.onCrashCallback) {
      this.onCrashCallback(reason, error);
    }

    // Attempt graceful shutdown
    this.initiateGracefulShutdown();
  }

  public runEmergencyHandlers(): void {
    for (const handler of this.emergencyHandlers) {
      try {
        handler();
      } catch (error) {
        console.error('Error in emergency handler:', error);
      }
    }
  }

  private async initiateGracefulShutdown(): Promise<void> {
    if (this.shutdownInProgress) return;

    this.shutdownInProgress = true;
    console.log('Initiating graceful shutdown...');

    try {
      // Set up timeout to force exit
      const timeoutId = setTimeout(() => {
        console.error('Graceful shutdown timeout exceeded. Forcing exit.');
        process.exit(1);
      }, this.gracefulShutdownTimeout);

      // Perform graceful shutdown operations
      await this.performGracefulShutdown();

      // Clear timeout and exit normally
      clearTimeout(timeoutId);
      process.exit(0);
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  private async performGracefulShutdown(): Promise<void> {
    // Placeholder for graceful shutdown operations
    // This would be implemented based on application needs
    console.log('Performing graceful shutdown operations...');

    // Example operations:
    // - Close database connections
    // - Finish processing current requests
    // - Save state to disk
    // - Clean up resources

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  public addEmergencyHandler(handler: () => void): void {
    this.emergencyHandlers.add(handler);
  }

  public removeEmergencyHandler(handler: () => void): void {
    this.emergencyHandlers.delete(handler);
  }

  public isShutdownInProgress(): boolean {
    return this.shutdownInProgress;
  }

  public forceShutdown(exitCode: number = 1): void {
    console.log(`Force shutdown initiated with exit code ${exitCode}`);
    this.runEmergencyHandlers();
    process.exit(exitCode);
  }

  public cleanup(): void {
    // Remove all process handlers
    for (const [event, handler] of this.processHandlerRefs) {
      try {
        process.removeListener(event, handler as (...args: unknown[]) => void);
      } catch (error) {
        console.warn(`Failed to remove ${event} handler:`, error);
      }
    }

    this.processHandlerRefs.clear();
    this.emergencyHandlers.clear();
    this.shutdownInProgress = false;
  }

  public getHandlerCount(): number {
    return this.processHandlerRefs.size;
  }

  public getEmergencyHandlerCount(): number {
    return this.emergencyHandlers.size;
  }
}
