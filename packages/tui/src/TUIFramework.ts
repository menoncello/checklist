import { ComponentRegistry } from './components/ComponentRegistry';
import { DebugIntegration } from './debug';
import { ErrorBoundary } from './errors/ErrorBoundary';
import { EventManager } from './events/EventManager';
import { KeyboardHandler } from './events/KeyboardHandler';
import { ApplicationLoop } from './framework/ApplicationLoop';
import { LifecycleManager } from './framework/Lifecycle';
import { TerminalCanvas } from './framework/TerminalCanvas';
import { Screen, Component } from './framework/UIFramework';
import { PerformanceManager } from './performance';
import { ScreenManager } from './screens/ScreenManager';
import { CapabilityDetector } from './terminal/CapabilityDetector';

export interface TUIFrameworkConfig {
  // Framework settings
  enableFramework: boolean;
  targetFPS: number;

  // Performance settings
  enablePerformanceMonitoring: boolean;
  performanceTargets: {
    startupTime: number;
    renderTime: number;
    memoryLimit: number;
  };

  // Debug settings
  enableDebugMode: boolean;
  debugInProduction: boolean;

  // Error handling
  enableErrorBoundaries: boolean;
  enableCrashRecovery: boolean;

  // Terminal settings
  enableTerminalDetection: boolean;
  fallbackToBasic: boolean;

  // Event handling
  enableKeyboardShortcuts: boolean;
  enableMouseSupport: boolean;
}

export interface TUIFrameworkState {
  isInitialized: boolean;
  isRunning: boolean;
  currentScreen: string | null;
  componentCount: number;
  errorCount: number;
  startupTime: number;
  uptime: number;
}

export class TUIFramework {
  private config: TUIFrameworkConfig;
  private state: TUIFrameworkState;

  // Core components
  private canvas!: TerminalCanvas;
  private applicationLoop!: ApplicationLoop;
  private lifecycle!: LifecycleManager;
  private screenManager!: ScreenManager;
  private componentRegistry!: ComponentRegistry;
  private eventManager!: EventManager;
  private keyboardHandler!: KeyboardHandler;
  private capabilityDetector!: CapabilityDetector;
  private errorBoundary?: ErrorBoundary;
  private performanceManager?: PerformanceManager;
  private debugIntegration?: DebugIntegration;

  private eventHandlers = new Map<string, Set<Function>>();
  private isShuttingDown = false;

  constructor(config: Partial<TUIFrameworkConfig> = {}) {
    this.config = {
      enableFramework: true,
      targetFPS: 60,
      enablePerformanceMonitoring: true,
      performanceTargets: {
        startupTime: 100, // 100ms
        renderTime: 16, // 16ms (60 FPS)
        memoryLimit: 50 * 1024 * 1024, // 50MB
      },
      enableDebugMode: process.env.NODE_ENV !== 'production',
      debugInProduction: false,
      enableErrorBoundaries: true,
      enableCrashRecovery: true,
      enableTerminalDetection: true,
      fallbackToBasic: true,
      enableKeyboardShortcuts: true,
      enableMouseSupport: false,
      ...config,
    };

    this.state = {
      isInitialized: false,
      isRunning: false,
      currentScreen: null,
      componentCount: 0,
      errorCount: 0,
      startupTime: 0,
      uptime: 0,
    };

    this.initializeFramework();
  }

  private async initializeFramework(): Promise<void> {
    const startTime = performance.now();

    try {
      // Initialize performance monitoring first
      if (this.config.enablePerformanceMonitoring) {
        this.performanceManager = new PerformanceManager({
          enableMonitoring: true,
          enableStartupProfiling: true,
          enableMemoryTracking: true,
          enableMetricsCollection: true,
        });

        this.performanceManager.startStartupPhase('framework_init', {
          description: 'TUI Framework initialization',
        });
      }

      // Initialize debug integration
      if (this.config.enableDebugMode === true) {
        this.debugIntegration = new DebugIntegration({
          enableInProduction: this.config.debugInProduction,
          enablePerformanceIntegration: this.config.enablePerformanceMonitoring,
        });

        if (this.performanceManager != null) {
          this.debugIntegration.setPerformanceManager(this.performanceManager);
        }

        this.debugIntegration.log(
          'info',
          'Framework',
          'TUI Framework initialization started'
        );
      }

      // Initialize terminal capabilities
      if (this.config.enableTerminalDetection) {
        this.capabilityDetector = new CapabilityDetector();

        await this.capabilityDetector.detect();
        this.debugIntegration?.log(
          'info',
          'Terminal',
          'Terminal capabilities detected'
        );
      }

      // Initialize canvas
      this.canvas = new TerminalCanvas();

      // Initialize error boundary
      if (this.config.enableErrorBoundaries) {
        this.errorBoundary = new ErrorBoundary({
          maxRetries: 3,
          retryDelay: 1000,
          logErrors: true,
          enableStatePreservation: true,
          fallbackRenderer: (error: Error) => `Error: ${error.message}`,
        });

        this.errorBoundary.on('errorCaught', (data: unknown) => {
          this.state.errorCount++;
          this.debugIntegration?.log(
            'error',
            'Framework',
            'Error caught by boundary',
            data
          );
        });
      }

      // Initialize component registry
      this.componentRegistry = new ComponentRegistry();

      // Initialize event system
      this.eventManager = new EventManager();

      this.keyboardHandler = new KeyboardHandler();

      // Initialize screen manager
      this.screenManager = new ScreenManager({
        enableTransitions: true,
        enableHistory: true,
        transitionDuration: 300,
        maxStackSize: 10,
        historySize: 50,
      });

      // Initialize lifecycle manager
      this.lifecycle = new LifecycleManager();

      // Initialize application loop
      this.applicationLoop = new ApplicationLoop(this.config.targetFPS);

      // Setup event handlers
      this.setupEventHandlers();

      // Complete initialization
      this.state.isInitialized = true;
      this.state.startupTime = performance.now() - startTime;

      if (this.performanceManager != null) {
        this.performanceManager.endStartupPhase('framework_init');
        this.performanceManager.addStartupMilestone(
          'framework_initialized',
          'Framework initialization completed'
        );
      }

      this.debugIntegration?.log(
        'info',
        'Framework',
        `TUI Framework initialized in ${this.state.startupTime.toFixed(2)}ms`
      );
      this.emit('initialized', { startupTime: this.state.startupTime });
    } catch (error) {
      this.debugIntegration?.log(
        'error',
        'Framework',
        'Framework initialization failed',
        error
      );
      this.state.errorCount++;
      throw error;
    }
  }

  private setupEventHandlers(): void {
    // Application loop events
    this.applicationLoop.on('frame', (data) => {
      this.handleFrame(data);
    });

    this.applicationLoop.on('input', (data) => {
      this.handleInput(data);
    });

    // Keyboard events
    this.keyboardHandler.on('keyPressed', (data: unknown) => {
      // First try debug integration
      if (
        this.debugIntegration?.handleKeyPress((data as { key: string }).key) ===
        true
      ) {
        return;
      }

      // Then try current screen
      const currentScreen = this.screenManager.getCurrentScreen();
      if (
        currentScreen &&
        'handleKeyPress' in currentScreen &&
        typeof currentScreen.handleKeyPress === 'function'
      ) {
        const keyData = data as { key: string };
        currentScreen.handleKeyPress(keyData.key);
      }

      this.debugIntegration?.logComponentEvent('keyboard', 'keyPress', data);
    });

    // Screen manager events
    this.screenManager.on('screenChanged', (data: unknown) => {
      if (
        data !== null &&
        data !== undefined &&
        typeof data === 'object' &&
        'screen' in data
      ) {
        const screenData = data as { screen: { getId(): string } };
        this.state.currentScreen = screenData.screen.getId();
        this.debugIntegration?.log(
          'info',
          'Navigation',
          `Screen changed to: ${screenData.screen.getId()}`
        );
      }
    });

    // Error boundary events
    this.errorBoundary?.on('errorCaught', (data: unknown) => {
      this.debugIntegration?.log(
        'error',
        'ErrorBoundary',
        'Error caught',
        data
      );
    });

    // Performance events
    this.performanceManager?.on('performanceAlert', (data: unknown) => {
      const alertData = data as { alert: { message: string } };
      this.debugIntegration?.log(
        'warn',
        'Performance',
        `Performance alert: ${alertData.alert.message}`,
        data
      );
    });

    // Graceful shutdown handling
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
  }

  private handleFrame(_data: unknown): void {
    if (!this.state.isRunning || this.isShuttingDown) return;

    try {
      // Update uptime
      this.state.uptime = performance.now();

      // Render current screen
      const currentScreen = this.screenManager.getCurrentScreen();
      if (currentScreen) {
        const screenOutput = currentScreen.render();
        this.canvas.setContent(screenOutput);
      }

      // Render debug overlay if enabled
      if (this.debugIntegration?.isVisible() === true) {
        const debugOverlay = this.debugIntegration.renderOverlay(
          this.canvas.getWidth(),
          this.canvas.getHeight()
        );
        this.canvas.addOverlay(debugOverlay);
      }

      // Commit to terminal
      this.canvas.render();

      // Update component count
      this.state.componentCount = this.componentRegistry.getComponentCount();
    } catch (error) {
      this.errorBoundary?.handleError(error as Error, {});
    }
  }

  private handleInput(data: unknown): void {
    if (!this.state.isRunning) return;

    try {
      if (
        'handleInput' in this.keyboardHandler &&
        typeof this.keyboardHandler.handleInput === 'function'
      ) {
        this.keyboardHandler.handleInput(data);
      }
    } catch (error) {
      this.errorBoundary?.handleError(error as Error, {});
    }
  }

  // Public API
  public async start(): Promise<void> {
    if (!this.state.isInitialized) {
      throw new Error('Framework not initialized');
    }

    if (this.state.isRunning) {
      return;
    }

    this.debugIntegration?.log('info', 'Framework', 'Starting TUI Framework');

    // Start performance profiling for startup
    if (this.performanceManager != null) {
      this.performanceManager.startStartupPhase('application_start', {
        description: 'Application startup',
      });
    }

    // Start application loop
    await this.applicationLoop.start();
    this.state.isRunning = true;

    // Complete startup profiling
    if (this.performanceManager != null) {
      this.performanceManager.endStartupPhase('application_start');
      this.performanceManager.completeStartup();
    }

    this.debugIntegration?.log('info', 'Framework', 'TUI Framework started');
    this.emit('started');
  }

  public async stop(): Promise<void> {
    if (!this.state.isRunning) return;

    this.debugIntegration?.log('info', 'Framework', 'Stopping TUI Framework');

    this.state.isRunning = false;
    await this.applicationLoop.stop();

    this.debugIntegration?.log('info', 'Framework', 'TUI Framework stopped');
    this.emit('stopped');
  }

  public async shutdown(signal?: string): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;
    this.debugIntegration?.log(
      'info',
      'Framework',
      `Shutting down TUI Framework (${signal ?? 'manual'})`
    );

    try {
      // Stop application loop
      await this.stop();

      // Cleanup components
      if (
        'destroy' in this.componentRegistry &&
        typeof this.componentRegistry.destroy === 'function'
      ) {
        this.componentRegistry.destroy();
      }
      if (
        'destroy' in this.screenManager &&
        typeof this.screenManager.destroy === 'function'
      ) {
        this.screenManager.destroy();
      }
      if (
        'destroy' in this.eventManager &&
        typeof this.eventManager.destroy === 'function'
      ) {
        this.eventManager.destroy();
      }
      this.performanceManager?.destroy();
      if (
        'destroy' in this.canvas &&
        typeof this.canvas.destroy === 'function'
      ) {
        this.canvas.destroy();
      }

      this.debugIntegration?.log(
        'info',
        'Framework',
        'TUI Framework shutdown complete'
      );
    } catch (error) {
      this.debugIntegration?.log(
        'error',
        'Framework',
        'Error during shutdown',
        error
      );
    }

    process.exit(0);
  }

  // Screen management
  public registerScreen(screen: Screen): void {
    if (
      'registerScreen' in this.screenManager &&
      typeof this.screenManager.registerScreen === 'function'
    ) {
      this.screenManager.registerScreen(screen);
    }
    const screenId =
      'getId' in screen && typeof screen.getId === 'function'
        ? screen.getId()
        : 'unknown';
    this.debugIntegration?.log(
      'debug',
      'Framework',
      `Screen registered: ${screenId}`
    );
  }

  public navigateToScreen(screenId: string, data?: unknown): void {
    if (
      'push' in this.screenManager &&
      typeof this.screenManager.push === 'function'
    ) {
      this.screenManager.push(screenId, data);
    }
    this.debugIntegration?.logComponentEvent('navigation', 'navigate', {
      screenId,
      data,
    });
  }

  public goBack(): boolean {
    let result = false;
    if (
      'pop' in this.screenManager &&
      typeof this.screenManager.pop === 'function'
    ) {
      result = this.screenManager.pop();
    }
    if (result) {
      this.debugIntegration?.logComponentEvent('navigation', 'back', {});
    }
    return result;
  }

  // Component management
  public registerComponent(name: string, component: Component): void {
    if (
      'register' in this.componentRegistry &&
      typeof this.componentRegistry.register === 'function'
    ) {
      this.componentRegistry.register(name, component);
    }
    this.debugIntegration?.log(
      'debug',
      'Framework',
      `Component registered: ${name}`
    );
  }

  // Event handling
  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)?.add(handler);
  }

  public off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          this.debugIntegration?.log(
            'error',
            'Framework',
            `Error in event handler for '${event}'`,
            error
          );
        }
      });
    }
  }

  // Getters
  public getState(): TUIFrameworkState {
    return { ...this.state };
  }

  public getConfig(): TUIFrameworkConfig {
    return { ...this.config };
  }

  public getPerformanceManager(): PerformanceManager {
    if (!this.performanceManager) {
      throw new Error('PerformanceManager not initialized');
    }
    return this.performanceManager;
  }

  public getDebugIntegration(): DebugIntegration {
    if (!this.debugIntegration) {
      throw new Error('DebugIntegration not initialized');
    }
    return this.debugIntegration;
  }

  public getCanvas(): TerminalCanvas {
    return this.canvas;
  }

  public getScreenManager(): ScreenManager {
    return this.screenManager;
  }

  public getComponentRegistry(): ComponentRegistry {
    return this.componentRegistry;
  }

  // UIFramework interface implementation
  public render(): void {
    this.canvas.render();
  }

  public handleEvent(event: unknown): void {
    if (
      'handleEvent' in this.eventManager &&
      typeof this.eventManager.handleEvent === 'function'
    ) {
      this.eventManager.handleEvent(event);
    }
  }

  public getMetrics(): Record<string, unknown> {
    const debugMetrics = this.debugIntegration?.getDebugManager().getMetrics();

    return {
      uptime: this.state.uptime,
      memoryUsage: process.memoryUsage().heapUsed,
      componentCount: this.state.componentCount,
      ...debugMetrics,
    };
  }
}
