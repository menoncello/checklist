import { EventEmitter } from 'events';
import { ComponentRegistry } from './components/ComponentRegistry';
import { DebugIntegration } from './debug';
import { ErrorBoundary } from './errors/ErrorBoundary';
import { EventManager } from './events/EventManager';
import { KeyboardHandler } from './events/KeyboardHandler';
import { ApplicationLoop } from './framework/ApplicationLoop';
import { EventHandlerSetup } from './framework/EventHandlerSetup';
import { FrameworkInitializer, InitializationContext, TUIFrameworkConfig } from './framework/FrameworkInitializer';
import { FrameworkUtils, TUIFrameworkState } from './framework/FrameworkUtils';
import { LifecycleManager } from './framework/Lifecycle';
import { TerminalCanvas } from './framework/TerminalCanvas';
import { Screen, Component } from './framework/UIFramework';
import { PerformanceManager } from './performance';
import { ScreenManager } from './screens/ScreenManager';
import { CapabilityDetector } from './terminal/CapabilityDetector';

export { TUIFrameworkConfig, TUIFrameworkState };

export class TUIFramework extends EventEmitter {
  private config: TUIFrameworkConfig;
  private state: TUIFrameworkState;

  // Core components
  private performanceManager?: PerformanceManager;
  private debugIntegration?: DebugIntegration;
  private capabilityDetector?: CapabilityDetector;
  private canvas?: TerminalCanvas;
  private errorBoundary?: ErrorBoundary;
  private componentRegistry?: ComponentRegistry;
  private eventManager?: EventManager;
  private keyboardHandler?: KeyboardHandler;
  private screenManager?: ScreenManager;
  private lifecycle?: LifecycleManager;
  private applicationLoop?: ApplicationLoop;

  // Initialization helpers
  private initializer: FrameworkInitializer;
  private eventSetup?: EventHandlerSetup;

  constructor(config: Partial<TUIFrameworkConfig> = {}) {
    super();
    this.config = FrameworkUtils.createDefaultConfig(config);
    this.state = FrameworkUtils.createInitialState();
    this.initializer = new FrameworkInitializer(this.config);
  }

  async start(): Promise<void> {
    if (this.state.isRunning) {
      throw new Error('Framework is already running');
    }

    try {
      const context = await this.initializer.initialize();
      this.assignComponents(context);
      this.setupEventHandlers();
      this.completeStartup();
    } catch (error) {
      this.debugIntegration?.log('error', 'Framework', 'Failed to start framework', error);
      throw error;
    }
  }

  private assignComponents(context: InitializationContext): void {
    this.performanceManager = context.performanceManager;
    this.debugIntegration = context.debugIntegration;
    this.capabilityDetector = context.capabilityDetector;
    this.canvas = context.canvas;
    this.errorBoundary = context.errorBoundary;
    this.componentRegistry = context.componentRegistry;
    this.eventManager = context.eventManager;
    this.keyboardHandler = context.keyboardHandler;
    this.screenManager = context.screenManager;
    this.lifecycle = context.lifecycle;
    this.applicationLoop = context.applicationLoop;
  }

  private setupEventHandlers(): void {
    this.eventSetup = new EventHandlerSetup({
      applicationLoop: this.applicationLoop,
      keyboardHandler: this.keyboardHandler,
      screenManager: this.screenManager,
      errorBoundary: this.errorBoundary,
      performanceManager: this.performanceManager,
      debugIntegration: this.debugIntegration,
      state: this.state,
      eventEmitter: this,
    });

    this.eventSetup.setupAllEventHandlers();
  }

  private completeStartup(): void {
    this.state.isInitialized = true;
    this.state.isRunning = true;
    this.state.startupTime = this.initializer.getInitializationTime();

    this.emit('initialized', { startupTime: this.state.startupTime });
    this.debugIntegration?.log('info', 'Framework', 'TUI Framework started successfully');
  }

  async stop(): Promise<void> {
    if (!this.state.isRunning) {
      throw new Error('Framework is not running');
    }

    this.state.isRunning = false;
    this.applicationLoop?.stop();
    this.emit('stopped');

    this.debugIntegration?.log('info', 'Framework', 'TUI Framework stopped');
  }

  async shutdown(signal?: string): Promise<void> {
    try {
      FrameworkUtils.logShutdownStart(signal);

      if (this.state.isRunning) {
        await this.stop();
      }

      this.cleanupComponents();
      this.state.isInitialized = false;

      FrameworkUtils.logShutdownComplete();
      this.emit('shutdown', { signal });
    } catch (error) {
      FrameworkUtils.logShutdownError(error);
      this.emit('shutdownError', { error, signal });
      throw error;
    }
  }

  private cleanupComponents(): void {
    const components = [
      this.performanceManager,
      this.debugIntegration,
      this.errorBoundary,
      this.componentRegistry,
      this.eventManager,
      this.keyboardHandler,
      this.screenManager,
      this.lifecycle,
      this.applicationLoop,
    ];

    components.forEach(FrameworkUtils.destroyIfExists);
  }

  // Public API methods
  registerScreen(screen: Screen): void {
    if (!this.screenManager) {
      throw new Error('Screen manager not initialized');
    }

    this.screenManager.registerScreen(screen);
    this.debugIntegration?.log('info', 'Framework', `Screen registered: ${screen.id}`);
  }

  navigateToScreen(screenId: string, data?: unknown): void {
    if (!this.screenManager) {
      throw new Error('Screen manager not initialized');
    }

    this.screenManager.navigateTo(screenId, data);
    this.debugIntegration?.log('info', 'Framework', `Navigated to screen: ${screenId}`);
  }

  goBack(): boolean {
    if (!this.screenManager) {
      throw new Error('Screen manager not initialized');
    }

    const result = this.screenManager.goBack();
    this.debugIntegration?.log('info', 'Framework', `Go back result: ${result}`);
    return result;
  }

  registerComponent(name: string, component: Component): void {
    if (!this.componentRegistry) {
      throw new Error('Component registry not initialized');
    }

    this.componentRegistry.register(name, component);
    this.state.componentCount++;
    this.debugIntegration?.log('info', 'Framework', `Component registered: ${name}`);
  }

  on(event: string, handler: Function): this {
    if (FrameworkUtils.isValidHandlerFunction(handler)) {
      super.on(event, handler);
    }
    return this;
  }

  off(event: string, handler: Function): this {
    if (FrameworkUtils.isValidHandlerFunction(handler)) {
      super.off(event, handler);
    }
    return this;
  }

  // Getter methods
  getState(): TUIFrameworkState {
    return { ...this.state };
  }

  getConfig(): TUIFrameworkConfig {
    return { ...this.config };
  }

  getPerformanceManager(): PerformanceManager | undefined {
    return this.performanceManager;
  }

  getDebugIntegration(): DebugIntegration | undefined {
    return this.debugIntegration;
  }

  getCanvas(): TerminalCanvas | undefined {
    return this.canvas;
  }

  getScreenManager(): ScreenManager | undefined {
    return this.screenManager;
  }

  getComponentRegistry(): ComponentRegistry | undefined {
    return this.componentRegistry;
  }

  render(): void {
    this.canvas?.render();
  }

  handleEvent(event: unknown): void {
    this.eventManager?.handleEvent(event);
  }

  getMetrics(): Record<string, unknown> {
    return FrameworkUtils.createMetricsSnapshot(this.state, this.performanceManager);
  }
}