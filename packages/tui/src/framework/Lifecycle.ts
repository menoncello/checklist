import { LifecycleState } from './UIFramework';

export type LifecyclePhase =
  | 'initializing'
  | 'running'
  | 'shutting-down'
  | 'stopped';

export interface LifecycleHooks {
  onInitialize?: () => Promise<void> | void;
  onStart?: () => Promise<void> | void;
  onStop?: () => Promise<void> | void;
  onShutdown?: () => Promise<void> | void;
  onError?: (error: Error) => Promise<void> | void;
}

export class LifecycleManager {
  private state: LifecycleState;
  private hooks: LifecycleHooks[] = [];
  private shutdownHandlers: (() => Promise<void>)[] = [];
  private errorHandlers: ((error: Error) => void)[] = [];
  private stateChangeListeners: ((state: LifecycleState) => void)[] = [];

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

    process.once('SIGINT', () => gracefulShutdown('SIGINT'));
    process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

    process.on('uncaughtException', (error) => {
      this.handleError(error);
    });

    process.on('unhandledRejection', (reason, _promise) => {
      this.handleError(new Error(`Unhandled Promise Rejection: ${reason}`));
    });
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
          await this.executeHook(hook.onInitialize);
        }
      }

      this.updatePhase('running');

      // Execute start hooks
      for (const hook of this.hooks) {
        if (hook.onStart != null) {
          await this.executeHook(hook.onStart);
        }
      }
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    if (
      this.state.phase === 'stopped' ||
      this.state.phase === 'shutting-down'
    ) {
      return;
    }

    this.updatePhase('shutting-down');

    try {
      // Execute stop hooks
      for (const hook of this.hooks) {
        if (hook.onStop != null) {
          await this.executeHook(hook.onStop);
        }
      }

      // Execute shutdown handlers in reverse order
      for (let i = this.shutdownHandlers.length - 1; i >= 0; i--) {
        await this.executeHook(this.shutdownHandlers[i]);
      }

      // Execute shutdown hooks
      for (const hook of this.hooks) {
        if (hook.onShutdown != null) {
          await this.executeHook(hook.onShutdown);
        }
      }

      // Clear component registry
      this.state.components.clear();
      this.state.screens = [];

      this.updatePhase('stopped');
    } catch (error) {
      this.handleError(error as Error);
      // Force shutdown even if hooks fail
      this.updatePhase('stopped');
    }
  }

  private async executeHook(hookFn: () => Promise<void> | void): Promise<void> {
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
          const result = hook.onError(error);
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

  private updatePhase(phase: LifecyclePhase): void {
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
}
