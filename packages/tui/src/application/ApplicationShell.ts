import { createLogger } from '@checklist/core/utils/logger';
import { InputEvent } from '../framework/ApplicationLoop';
import { LifecycleHooks, LifecyclePhase } from '../framework/Lifecycle';
import {
  UIFramework,
  EventHandler,
  LifecycleState,
  Screen,
  ComponentInstance,
  PerformanceMetrics,
} from '../framework/UIFramework';
import {
  ApplicationState,
  ApplicationShellConfig,
} from './ApplicationShellConfig';

import {
  ApplicationShellInitializers,
  ApplicationShellDependencies,
} from './ApplicationShellInitializers';

const logger = createLogger('checklist:tui:application-shell');

export class ApplicationShell implements UIFramework, LifecycleHooks {
  private deps!: ApplicationShellDependencies;
  private initializers = new ApplicationShellInitializers();
  private startupStartTime = 0;

  constructor(config: ApplicationShellConfig) {
    this.initializeAll(config);
    this.setupEventHandlers();
    this.registerLifecycleHooks();

    // Set this ApplicationShell instance on the panicRecovery to break circular dependency
    if (Boolean(this.deps?.panicRecovery?.setApplicationShell)) {
      this.deps.panicRecovery.setApplicationShell(this);
    }
  }

  private initializeAll(config: ApplicationShellConfig): void {
    this.deps = this.initializers.createDependencies(config);
  }

  private setupEventHandlers(): void {
    if (Boolean(this.deps?.applicationLoop?.on)) {
      this.deps.applicationLoop.on('input', (input: unknown) => {
        this.deps.methods.handleInput(input as InputEvent);
      });

      this.deps.applicationLoop.on('resize', (event: unknown) => {
        const size = event as { width: number; height: number };
        this.deps.methods.handleResize(size.width, size.height);
      });

      this.deps.applicationLoop.on('error', (event: unknown) => {
        this.deps.methods.handleError(event as Error);
      });

      this.deps.applicationLoop.on('signal', (event: unknown) => {
        const signal = event as { type: string };
        this.deps.methods.handleSignal(signal.type);
      });
    }

    if (Boolean(this.deps?.lifecycleManager?.onStateChange)) {
      this.deps.lifecycleManager.onStateChange((state: LifecycleState) => {
        this.deps.events.emitLifecycleStateChanged(state);
      });
    }

    if (Boolean(this.deps?.performanceMonitor?.on)) {
      this.deps.performanceMonitor.on('alert', (alert: unknown) => {
        this.deps.events.emitPerformanceAlert(alert);
      });
    }
  }

  private registerLifecycleHooks(): void {
    this.registerLifecycleManagerHook();
    this.registerTerminalManagerHook();
    this.registerSplitPaneLayoutHook();
    this.registerInputRouterHook();
    this.registerShutdownManagerHook();
    this.registerErrorBoundaryHook();
  }

  private registerLifecycleManagerHook(): void {
    if (Boolean(this.deps?.lifecycleManager?.registerHooks)) {
      this.deps.lifecycleManager.registerHooks(this);
    }
  }

  private registerTerminalManagerHook(): void {
    if (Boolean(this.deps?.terminalManager?.registerHooks)) {
      this.deps.terminalManager.registerHooks(this.deps.lifecycleManager);
    }
  }

  private registerSplitPaneLayoutHook(): void {
    if (Boolean(this.deps?.splitPaneLayout?.registerHooks)) {
      this.deps.splitPaneLayout.registerHooks(this.deps.lifecycleManager);
    }
  }

  private registerInputRouterHook(): void {
    if (Boolean(this.deps?.inputRouter?.registerHooks)) {
      this.deps.inputRouter.registerHooks(this.deps.lifecycleManager);
    }
  }

  private registerShutdownManagerHook(): void {
    if (Boolean(this.deps?.shutdownManager?.registerHooks)) {
      this.deps.shutdownManager.registerHooks(this.deps.lifecycleManager);
    }
  }

  private registerErrorBoundaryHook(): void {
    if (Boolean(this.deps?.errorBoundary?.registerHooks)) {
      this.deps.errorBoundary.registerHooks(this.deps.lifecycleManager);
    }
  }

  public async onInitialize(): Promise<boolean> {
    this.startupStartTime = performance.now();
    logger.info({
      msg: 'Initializing Application Shell',
      version: this.deps.config.version,
    });

    // Update lifecycle state to initializing if not already managed by LifecycleManager
    const currentState = this.deps.lifecycleManager.getState();
    if (currentState.phase === 'stopped') {
      this.deps.lifecycleManager.updatePhase('initializing');
    }

    try {
      await this.deps.errorBoundary.execute(async () => {
        await this.initializeSubsystems();
        this.deps.lifecycle.displaySplashScreen();
        this.deps.startup.recordStartupMetrics(this.startupStartTime);

        // Trigger render to display splash screen
        this.render();
      });
      return true;
    } catch (error) {
      await this.deps.lifecycle.handleInitializationError(error as Error);
      return false;
    }
  }

  private async initializeSubsystems(): Promise<void> {
    await this.deps.startup.initializeSubsystems(
      this.deps.terminalManager,
      this.deps.splitPaneLayout,
      this.deps.inputRouter,
      this.deps.shutdownManager
    );
  }

  public async onStart(): Promise<void> {
    // Update lifecycle state to running when starting
    const currentState = this.deps.lifecycleManager.getState();
    if (
      currentState.phase === 'initializing' ||
      currentState.phase === 'stopped'
    ) {
      this.deps.lifecycleManager.updatePhase('running');
    }

    await this.deps.startup.start(this.deps.applicationLoop, () =>
      this.render()
    );
  }

  public async onStop(): Promise<void> {
    // Update lifecycle state to stopped if transitioning from running
    const currentState = this.deps.lifecycleManager.getState();
    if (currentState.phase === 'running') {
      this.deps.lifecycleManager.updatePhase('stopped');
    }

    await this.deps.startup.stop(this.deps.applicationLoop);
  }

  public async onShutdown(): Promise<boolean> {
    logger.info({ msg: 'Shutting down Application Shell' });

    // Update lifecycle state to shutting-down and then to stopped
    this.deps.lifecycleManager.updatePhase('shutting-down');

    try {
      await this.deps.errorBoundary.execute(async () => {
        await this.deps.shutdownManager.executeGracefulShutdown();
        await this.deps.terminalManager.cleanup();
        await this.deps.splitPaneLayout.cleanup();
        await this.deps.inputRouter.onShutdown();
        this.deps.performanceMonitor.destroy();
      });

      // Update to stopped after successful shutdown
      this.deps.lifecycleManager.updatePhase('stopped');
      return true;
    } catch (error) {
      await this.deps.panicRecovery.handlePanic(error as Error, {
        phase: 'shutdown',
        component: 'application-shell',
        timestamp: Date.now(),
      });

      // Even if there's an error, we should be in stopped state
      this.deps.lifecycleManager.updatePhase('stopped');
      return false;
    }
  }

  public async onError(error: Error): Promise<void> {
    const errorMessage = error.message ?? 'Unknown error occurred';
    const errorStack = error.stack ?? 'No stack trace available';

    logger.error({
      msg: 'Application Shell error',
      error: errorMessage,
      stack: errorStack,
    });

    if (this.deps?.lifecycleManager == null) {
      logger.warn({
        msg: 'Application Shell dependencies not available during error handling',
        error: errorMessage,
      });
      return;
    }

    const currentPhase: LifecyclePhase =
      this.deps.lifecycleManager.getState().phase;

    try {
      await this.deps.errorBoundary.handleApplicationError(error, {
        phase: currentPhase,
        component: 'application-shell',
        timestamp: Date.now(),
        severity: 'high',
      });

      this.preserveLifecycleState(currentPhase);
    } catch (handlingError) {
      this.logHandlingError(error, handlingError);
    }
  }

  private preserveLifecycleState(currentPhase: LifecyclePhase): void {
    if (currentPhase === 'stopped') return;

    const newState = this.deps.lifecycleManager.getState();
    if (newState.phase === 'stopped') {
      this.deps.lifecycleManager.updatePhase(currentPhase);
    }
  }

  private logHandlingError(originalError: Error, handlingError: unknown): void {
    logger.error({
      msg: 'Error during error handling',
      originalError: originalError.message,
      handlingError:
        handlingError instanceof Error
          ? handlingError.message
          : String(handlingError),
    });
  }

  public render(): void {
    this.deps.renderer.render();
  }

  public async initialize(): Promise<void> {
    await this.deps.lifecycleManager.initialize();
  }

  public async shutdown(): Promise<void> {
    await this.deps.lifecycleManager.shutdown();
  }

  public pushScreen(screen: unknown): void {
    this.deps.methods.pushScreen(screen);
  }

  public popScreen(): void {
    this.deps.methods.popScreen();
  }

  public replaceScreen(screen: unknown): void {
    this.deps.methods.replaceScreen(screen);
  }

  public getCurrentScreen(): Screen | null {
    return this.deps.methods.getCurrentScreen();
  }

  public on(event: string, handler: EventHandler): void {
    this.deps.methods.on(event, handler);
  }

  public off(event: string, handler: EventHandler): void {
    this.deps.methods.off(event, handler);
  }

  public emit(event: string, data?: unknown): void {
    this.deps.methods.emit(event, data);
  }

  public registerComponent(name: string, component: unknown): void {
    this.deps.methods.registerComponent(name, component);
  }

  public createComponent(
    name: string,
    props: Record<string, unknown>
  ): ComponentInstance {
    return this.deps.methods.createComponent(name, props);
  }

  public getTerminalSize(): { width: number; height: number } {
    return this.deps.methods.getTerminalSize();
  }

  public isTerminalCapable(capability: string): boolean {
    return this.deps.methods.isTerminalCapable(capability);
  }

  public getMetrics(): PerformanceMetrics {
    return this.deps.methods.getMetrics();
  }

  public startProfiling(name: string): void {
    this.deps.methods.startProfiling(name);
  }

  public endProfiling(name: string): number {
    return this.deps.methods.endProfiling(name);
  }

  public getState(): ApplicationState {
    return this.deps.methods.getState();
  }

  public getLifecycleState(): LifecycleState {
    return this.deps.methods.getLifecycleState();
  }

  public getPerformanceReport(): unknown {
    return this.deps.methods.getPerformanceReport();
  }
}
