import { ErrorHandler } from './LifecycleErrorHandler';
import { LifecycleHookExecutor } from './LifecycleHookExecutor';
import { SignalHandler } from './LifecycleSignalHandler';
import { LifecycleStateUtils } from './LifecycleStateUtils';
import { type LifecycleHooks, type LifecyclePhase } from './LifecycleTypes';
import { LifecycleUtils } from './LifecycleUtils';
import { LifecycleState } from './UIFramework';

export class LifecycleManager {
  private state: LifecycleState;
  private hooks: LifecycleHooks[] = [];
  private shutdownHandlers: (() => Promise<void>)[] = [];
  private errorHandlers: ((error: Error) => void)[] = [];
  private stateChangeListeners: ((state: LifecycleState) => void)[] = [];
  private signalHandler: SignalHandler;
  private errorHandler: ErrorHandler;

  constructor(
    initialState: LifecycleState = {
      phase: 'stopped',
      startTime: 0,
      components: new Set<string>(),
      screens: [],
    }
  ) {
    this.state = initialState;
    this.errorHandler = new ErrorHandler(
      (phase: string) => this.updatePhase(phase as LifecyclePhase),
      () => this.notifyStateChange(),
      (error) => this.setErrorState(error)
    );
    this.signalHandler = new SignalHandler(
      (signal) => this.handleSignal(signal),
      (error) => this.errorHandler.handleUncaughtException(error),
      (reason, promise) =>
        this.errorHandler.handleUnhandledRejection(reason, promise)
    );
    this.setupSignalHandlers();
  }

  public getState(): LifecycleState {
    return {
      ...this.state,
      components: new Set(this.state.components),
      screens: [...this.state.screens],
    };
  }

  public updatePhase(phase: LifecyclePhase): void {
    const oldPhase = this.state.phase;
    this.state.phase = phase;

    // Set startTime when entering initializing phase
    if (phase === 'initializing' && this.state.startTime === 0) {
      this.state.startTime = Date.now();
    }

    this.notifyStateChange();

    if (oldPhase !== phase) {
      this.logPhaseTransition(oldPhase, phase);
    }
  }

  public registerHooks(hooks: LifecycleHooks): void {
    this.hooks.push(hooks);
  }

  public unregisterHooks(hooks: LifecycleHooks): void {
    const index = this.hooks.indexOf(hooks);
    if (index !== -1) {
      this.hooks.splice(index, 1);
    }
  }

  public registerShutdownHandler(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  public addShutdownHandler(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  public removeShutdownHandler(handler: () => Promise<void>): void {
    const index = this.shutdownHandlers.indexOf(handler);
    if (index !== -1) {
      this.shutdownHandlers.splice(index, 1);
    }
  }

  public registerErrorHandler(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  public addErrorHandler(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  public removeErrorHandler(handler: (error: Error) => void): void {
    const index = this.errorHandlers.indexOf(handler);
    if (index !== -1) {
      this.errorHandlers.splice(index, 1);
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

  public onStateChange(listener: (state: LifecycleState) => void): void {
    this.stateChangeListeners.push(listener);
  }

  public offStateChange(listener: (state: LifecycleState) => void): void {
    const index = this.stateChangeListeners.indexOf(listener);
    if (index !== -1) {
      this.stateChangeListeners.splice(index, 1);
    }
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
    if (this.state.screens.length === 0) {
      this.state.screens.push(screenId);
    } else {
      this.state.screens[this.state.screens.length - 1] = screenId;
    }
    this.notifyStateChange();
  }

  public getCurrentScreen(): string | undefined {
    return this.state.screens[this.state.screens.length - 1];
  }

  public getScreenCount(): number {
    return this.state.screens.length;
  }

  public getComponentCount(): number {
    return LifecycleStateUtils.getComponentCount(this.state);
  }

  public isRunning(): boolean {
    return LifecycleStateUtils.isRunning(this.state);
  }

  public isShuttingDown(): boolean {
    return LifecycleStateUtils.isShuttingDown(this.state);
  }

  public isStopped(): boolean {
    return LifecycleStateUtils.isStopped(this.state);
  }

  public getUptime(): number {
    return LifecycleStateUtils.getUptime(this.state);
  }

  public hasError(): boolean {
    return LifecycleStateUtils.hasError(this.state);
  }

  public getError(): Error | undefined {
    return LifecycleStateUtils.getError(this.state);
  }

  public clearError(): void {
    LifecycleStateUtils.clearError(this.state);
    this.notifyStateChange();
  }

  private setErrorState(error: Error): void {
    LifecycleStateUtils.setErrorState(this.state, error);
    this.notifyStateChange();
  }

  public async initialize(): Promise<void> {
    if (this.state.phase !== 'stopped') {
      throw new Error(`Cannot initialize from phase: ${this.state.phase}`);
    }

    this.updatePhase('initializing');

    try {
      await this.executeHooks('onInitialize');
    } catch (error) {
      await this.handleError(error as Error);
      throw error;
    }
  }

  public async start(): Promise<void> {
    if (this.state.phase === 'running') {
      throw new Error('Cannot start from phase: running');
    }

    if (this.state.phase !== 'initializing') {
      throw new Error(`Cannot start from phase: ${this.state.phase}`);
    }

    this.updatePhase('running');

    try {
      await this.executeHooks('onStart');
    } catch (error) {
      await this.handleError(error as Error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (this.state.phase === 'stopped') {
      return; // Already stopped, no-op
    }

    if (this.state.phase !== 'running') {
      throw new Error(`Cannot stop from ${this.state.phase} state`);
    }

    const previousPhase = this.state.phase;
    this.updatePhase('stopped');

    try {
      if (previousPhase === 'running') {
        await this.executeHooks('onStop');
      }
      this.cleanupSignalHandlers();
    } catch (error) {
      await this.handleError(error as Error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    if (this.state.phase === 'stopped') {
      return;
    }

    const wasRunning = this.state.phase === 'running';
    this.updatePhase('shutting-down');

    await this.executeShutdownSequence(wasRunning);
    this.performCleanup();
    this.updatePhase('stopped');
  }

  private async executeShutdownSequence(wasRunning: boolean): Promise<void> {
    let errorOccurred = false;

    if (wasRunning) {
      errorOccurred = await this.executeHooksWithErrorHandling('onStop');
    }

    const shutdownError =
      await this.executeHooksWithErrorHandling('onShutdown');
    errorOccurred = errorOccurred || shutdownError;

    await this.executeShutdownHandlersWithErrorHandling(!errorOccurred);
  }

  private performCleanup(): void {
    this.state.components.clear();
    this.state.screens = [];
    this.cleanupSignalHandlers();
  }

  private async executeHooks(methodName: keyof LifecycleHooks): Promise<void> {
    await LifecycleHookExecutor.executeHooks(this.hooks, methodName);
  }

  private async executeHooksWithErrorHandling(
    methodName: keyof LifecycleHooks
  ): Promise<boolean> {
    return await LifecycleHookExecutor.executeHooksWithErrorHandling(
      this.hooks,
      methodName,
      (error) => this.handleError(error)
    );
  }

  private async executeShutdownHandlersWithErrorHandling(
    handleErrors: boolean
  ): Promise<void> {
    try {
      await LifecycleHookExecutor.executeShutdownHandlers(
        this.shutdownHandlers.slice().reverse(),
        true
      );
    } catch (error) {
      if (handleErrors) {
        await this.handleError(error as Error);
      }
    }
  }

  private async handleError(error: Error): Promise<void> {
    await this.errorHandler.handleError(error, this.state, this.errorHandlers);
    await this.executeHooks('onError');
  }

  private notifyStateChange(): void {
    LifecycleUtils.notifyStateChange(
      this.getState(),
      this.stateChangeListeners
    );
  }

  private setupSignalHandlers(): void {
    LifecycleUtils.setupSignalHandlers(this.signalHandler);
  }

  private cleanupSignalHandlers(): void {
    LifecycleUtils.cleanupSignalHandlers(this.signalHandler);
  }

  private async handleSignal(signal: string): Promise<void> {
    await LifecycleUtils.handleSignal(signal, () => this.shutdown());
  }

  private logPhaseTransition(
    oldPhase: LifecyclePhase,
    newPhase: LifecyclePhase
  ): void {
    LifecycleUtils.logPhaseTransition(oldPhase, newPhase);
  }
}
