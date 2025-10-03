import { LifecycleState } from './UIFramework';

export type LifecyclePhase =
  | 'initializing'
  | 'running'
  | 'shutting-down'
  | 'stopped';

export interface LifecycleHooks {
  onInitialize?: () => Promise<void | boolean> | void | boolean;
  onStart?: () => Promise<void | boolean> | void | boolean;
  onStop?: () => Promise<void | boolean> | void | boolean;
  onShutdown?: () => Promise<void | boolean> | void | boolean;
  onError?: (error: Error) => Promise<void> | void;
}

export class LifecycleManager {
  private state: LifecycleState;
  private hooks: LifecycleHooks[] = [];
  private shutdownHandlers: (() => Promise<void>)[] = [];
  private errorHandlers: ((error: Error) => void)[] = [];
  private stateChangeListeners: ((state: LifecycleState) => void)[] = [];
  private sigintHandler?: () => void;
  private sigtermHandler?: () => void;
  private uncaughtExceptionHandler?: (error: Error) => void;
  private unhandledRejectionHandler?: (
    reason: unknown,
    promise: Promise<unknown>
  ) => void;

  constructor() {
    this.state = {
      phase: 'stopped',
      startTime: 0,
      components: new Set(),
      screens: [],
      errorState: undefined,
    };

    this.setupShutdownHandlers();
  }

  private setupShutdownHandlers(): void {
    const gracefulShutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}, initiating graceful shutdown...`);
      await this.shutdown();
      process.exit(0);
    };

    this.sigintHandler = () => gracefulShutdown('SIGINT');
    this.sigtermHandler = () => gracefulShutdown('SIGTERM');
    this.uncaughtExceptionHandler = (error) => this.handleError(error);
    this.unhandledRejectionHandler = (reason, _promise) => {
      this.handleError(new Error(`Unhandled Promise Rejection: ${reason}`));
    };

    process.once('SIGINT', this.sigintHandler);
    process.once('SIGTERM', this.sigtermHandler);
    process.on('uncaughtException', this.uncaughtExceptionHandler);
    process.on('unhandledRejection', this.unhandledRejectionHandler);
  }

  public async initialize(): Promise<void> {
    if (this.state.phase !== 'stopped') {
      throw new Error(`Cannot initialize from phase: ${this.state.phase}`);
    }

    this.updatePhase('initializing');
    this.state.startTime = Date.now();

    try {
      // Execute initialize hooks
      for (const hook of this.hooks) {
        if (hook.onInitialize != null) {
          await this.executeHook(hook.onInitialize.bind(hook));
        }
      }
      // Stay in initializing phase - wait for explicit start call
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  public async start(): Promise<void> {
    if (this.state.phase !== 'initializing') {
      throw new Error(`Cannot start from phase: ${this.state.phase}`);
    }

    try {
      // Execute start hooks
      for (const hook of this.hooks) {
        if (hook.onStart != null) {
          await this.executeHook(hook.onStart.bind(hook));
        }
      }

      this.updatePhase('running');
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (this.state.phase !== 'running') {
      return; // Already stopped or stopping
    }

    try {
      // Execute stop hooks
      for (const hook of this.hooks) {
        if (hook.onStop != null) {
          await this.executeHook(hook.onStop.bind(hook));
        }
      }

      this.updatePhase('stopped');
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    if (this.state.phase === 'stopped') {
      return;
    }

    this.updatePhase('shutting-down');

    try {
      await this.executeStopHooksIfNeeded();
      await this.executeShutdownHandlers();
      await this.executeShutdownHooks();
      this.clearComponentRegistry();
      this.cleanupProcessHandlers();
      this.updatePhase('stopped');
    } catch (error) {
      this.handleError(error as Error);
      // Force shutdown even if hooks fail
      this.updatePhase('stopped');
    }
  }

  private async executeStopHooksIfNeeded(): Promise<void> {
    // Stop first if running
    if (this.state.phase === 'shutting-down') {
      // Execute stop hooks if we were running
      for (const hook of this.hooks) {
        if (hook.onStop != null) {
          await this.executeHook(hook.onStop.bind(hook));
        }
      }
    }
  }

  private async executeShutdownHandlers(): Promise<void> {
    // Execute shutdown handlers in reverse order
    for (let i = this.shutdownHandlers.length - 1; i >= 0; i--) {
      await this.executeHook(this.shutdownHandlers[i]);
    }
  }

  private async executeShutdownHooks(): Promise<void> {
    // Execute shutdown hooks
    for (const hook of this.hooks) {
      if (hook.onShutdown != null) {
        await this.executeHook(hook.onShutdown.bind(hook));
      }
    }
  }

  private cleanupProcessHandlers(): void {
    if (this.uncaughtExceptionHandler) {
      process.off('uncaughtException', this.uncaughtExceptionHandler);
      this.uncaughtExceptionHandler = undefined;
    }

    if (this.unhandledRejectionHandler) {
      process.off('unhandledRejection', this.unhandledRejectionHandler);
      this.unhandledRejectionHandler = undefined;
    }

    // Note: SIGINT and SIGTERM use once() so they don't need explicit cleanup
    this.sigintHandler = undefined;
    this.sigtermHandler = undefined;
  }

  private clearComponentRegistry(): void {
    // Clear component registry
    this.state.components.clear();
    this.state.screens = [];
  }

  private async executeHook(
    hookFn: () => Promise<void | boolean> | void | boolean
  ): Promise<void> {
    try {
      const result = hookFn();
      if (result instanceof Promise) {
        await result;
      }
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  private handleError(error: Error): void {
    this.state.errorState = error;

    // Execute error hooks
    this.hooks.forEach((hook) => {
      if (hook.onError) {
        try {
          const result = hook.onError.bind(hook)(error);
          if (result instanceof Promise) {
            result.catch((hookError) => {
              console.error('Error in error hook:', hookError);
            });
          }
        } catch (hookError) {
          console.error('Error in error hook:', hookError);
        }
      }
    });

    // Execute error handlers
    this.errorHandlers.forEach((handler) => {
      try {
        handler(error);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    });

    this.notifyStateChange();
  }

  public updatePhase(phase: LifecyclePhase): void {
    this.state.phase = phase;
    this.notifyStateChange();
  }

  private notifyStateChange(): void {
    this.stateChangeListeners.forEach((listener) => {
      try {
        listener({ ...this.state });
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    });
  }

  public registerHooks(hooks: LifecycleHooks): void {
    this.hooks.push(hooks);
  }

  public unregisterHooks(hooks: LifecycleHooks): void {
    const index = this.hooks.indexOf(hooks);
    if (index > -1) {
      this.hooks.splice(index, 1);
    }
  }

  public addShutdownHandler(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  public removeShutdownHandler(handler: () => Promise<void>): void {
    const index = this.shutdownHandlers.indexOf(handler);
    if (index > -1) {
      this.shutdownHandlers.splice(index, 1);
    }
  }

  public addErrorHandler(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  public removeErrorHandler(handler: (error: Error) => void): void {
    const index = this.errorHandlers.indexOf(handler);
    if (index > -1) {
      this.errorHandlers.splice(index, 1);
    }
  }

  public onStateChange(listener: (state: LifecycleState) => void): void {
    this.stateChangeListeners.push(listener);
  }

  public offStateChange(listener: (state: LifecycleState) => void): void {
    const index = this.stateChangeListeners.indexOf(listener);
    if (index > -1) {
      this.stateChangeListeners.splice(index, 1);
    }
  }

  public registerComponent(componentId: string): void {
    this.state.components.add(componentId);
    this.notifyStateChange();
  }

  public unregisterComponent(componentId: string): void {
    this.state.components.delete(componentId);
    this.notifyStateChange();
  }

  public pushScreen(screenId: string): void {
    this.state.screens.push(screenId);
    this.notifyStateChange();
  }

  public popScreen(): string | undefined {
    const screen = this.state.screens.pop();
    this.notifyStateChange();
    return screen;
  }

  public replaceScreen(screenId: string): void {
    if (this.state.screens.length > 0) {
      this.state.screens[this.state.screens.length - 1] = screenId;
    } else {
      this.state.screens.push(screenId);
    }
    this.notifyStateChange();
  }

  public getState(): LifecycleState {
    return {
      ...this.state,
      components: new Set(this.state.components),
      screens: [...this.state.screens],
    };
  }

  public isRunning(): boolean {
    return this.state.phase === 'running';
  }

  public isShuttingDown(): boolean {
    return this.state.phase === 'shutting-down';
  }

  public isStopped(): boolean {
    return this.state.phase === 'stopped';
  }

  public getUptime(): number {
    if (this.state.startTime === 0) return 0;
    return Date.now() - this.state.startTime;
  }

  public getComponentCount(): number {
    return this.state.components.size;
  }

  public getScreenCount(): number {
    return this.state.screens.length;
  }

  public getCurrentScreen(): string | undefined {
    return this.state.screens[this.state.screens.length - 1];
  }

  public hasError(): boolean {
    return this.state.errorState !== undefined;
  }

  public getError(): Error | undefined {
    return this.state.errorState;
  }

  public clearError(): void {
    this.state.errorState = undefined;
    this.notifyStateChange();
  }

  // ApplicationShell specific methods
  public displaySplashScreen(): void {
    // This method is called by ApplicationShell to display version information
    // In a real implementation, this would render a splash screen
    console.log('Application Shell - Version 1.0.0');
  }

  public async handleInitializationError(error: Error): Promise<void> {
    // Handle initialization errors specifically
    console.error('Initialization error:', error.message);
    this.handleError(error);
    throw error;
  }
}
