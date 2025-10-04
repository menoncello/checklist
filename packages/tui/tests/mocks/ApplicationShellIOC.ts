/**
 * IOC Container for ApplicationShell Test Dependencies
 * Provides centralized dependency management for ApplicationShell tests
 */

import { ApplicationShellConfig } from '../../src/application/ApplicationShellConfig';

// Mock interfaces for type safety
export interface ILifecycleManager {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  shutdown(): Promise<void>;
  getState(): any;
  updatePhase(phase: string): void;
  registerComponent(id: string): void;
  unregisterComponent(id: string): boolean;
  pushScreen(screenId: string): void;
  popScreen(): string | undefined;
  isRunning(): boolean;
  onStateChange(callback: (state: any) => void): void;
  registerHooks(hooks: any): void;
  displaySplashScreen(): void;
  setStateManager?(stateManager: any): void; // Optional method for test mocks
}

export interface ISplitPaneLayout {
  getLeftPanelContent(): string[];
  getRightPanelContent(): string[];
  render(leftContent: string[], rightContent: string[]): string;
  initialize(): void;
  updateDimensions(): void;
  cleanup(): Promise<void>;
}

export interface IInputRouter {
  initialize(): void;
  routeInput(input: any): void;
  cleanup(): Promise<void>;
  onShutdown(): Promise<void>;
}

export interface IShutdownManager {
  onInitialize(): Promise<void>;
  onShutdown(): Promise<void>;
  registerHooks(): void;
  executeGracefulShutdown(reason?: string): Promise<any>;
}

export interface IErrorBoundary {
  initialize(): void;
  handleError(): void;
  recover(): void;
  execute(fn: () => Promise<void>): Promise<void>;
  handleApplicationError(error: Error, context: any): Promise<void>;
}

export interface IPanicRecovery {
  setApplicationShell(shell: any): void;
  setLogger(logger: any): void;
  initialize(): void;
  handlePanic(error: Error): Promise<void>;
  attemptRecovery(): Promise<boolean>;
}

export interface IPerformanceMonitor {
  startSampling(): void;
  stopSampling(): void;
  getMetrics(): any;
  startProfiling(name: string): void;
  endProfiling(name: string): number;
  getConfig(): any;
}

export interface ITerminalManager {
  getDimensions(): { width: number; height: number };
  hasCapability(name: string): boolean;
  detectCapabilities(): any;
  setupTerminal(): void;
  cleanup(): Promise<void>;
}

export interface IApplicationShellMethods {
  pushScreen(screen: any): void;
  popScreen(): any;
  getCurrentScreen(): any;
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
  emit(event: string, data?: any): void;
  getTerminalSize(): { width: number; height: number };
  isTerminalCapable(capability: string): boolean;
  getMetrics(): any;
  startProfiling(name: string): void;
  endProfiling(name: string): number;
  getPerformanceReport(): any;
}

export interface IApplicationShellRenderer {
  render(): void;
}

// IOC Container
export class ApplicationShellIOC {
  private services = new Map<string, any>();
  private singletons = new Map<string, any>();

  constructor() {
    this.registerDefaults();
  }

  // Service registration
  register<T>(key: string, factory: () => T, singleton = true): void {
    if (singleton) {
      this.singletons.set(key, null);
    }
    this.services.set(key, factory);
  }

  // Service resolution
  get<T>(key: string): T {
    const factory = this.services.get(key);
    if (!factory) {
      throw new Error(`Service '${key}' not registered`);
    }

    if (this.singletons.has(key)) {
      let instance = this.singletons.get(key);
      if (!instance) {
        instance = factory();
        this.singletons.set(key, instance);
      }
      return instance;
    }

    return factory();
  }

  // Create dependencies object for ApplicationShell
  createDependencies(config: ApplicationShellConfig) {
    const stateManager = this.get('stateManager');
    const lifecycleManager = this.get<ILifecycleManager>('lifecycleManager');

    // Connect lifecycle manager with state manager for state synchronization
    if (lifecycleManager.setStateManager) {
      lifecycleManager.setStateManager(stateManager);
    }

    return {
      config,
      lifecycleManager,
      applicationLoop: this.get('applicationLoop'),
      performanceMonitor: this.get<IPerformanceMonitor>('performanceMonitor'),
      terminalManager: this.get<ITerminalManager>('terminalManager'),
      splitPaneLayout: this.get<ISplitPaneLayout>('splitPaneLayout'),
      inputRouter: this.get<IInputRouter>('inputRouter'),
      shutdownManager: this.get<IShutdownManager>('shutdownManager'),
      errorBoundary: this.get<IErrorBoundary>('errorBoundary'),
      panicRecovery: this.get<IPanicRecovery>('panicRecovery'),
      uiFramework: this.get('uiFramework'),
      screens: this.get('screens'),
      components: this.get('components'),
      ui: this.get('ui'),
      stateManager,
      methods: this.get<IApplicationShellMethods>('methods'),
      renderer: this.get<IApplicationShellRenderer>('renderer'),
      state: this.get('state'),
      eventHandler: this.get('eventHandler'),
      lifecycle: this.get('lifecycle'),
      events: this.get('events'),
      performance: this.get('performance'),
      rendering: this.get('rendering'),
      startup: this.get('startup'),
    };
  }

  // Register default mock implementations
  private registerDefaults(): void {
    // LifecycleManager
    this.register<ILifecycleManager>('lifecycleManager', () => {
      let state = {
        phase: 'stopped',
        startTime: 0,
        components: new Set(),
        screens: [] as string[],
        errorState: undefined
      };
      let stateManagerRef: any = null;
      return {
        setStateManager(stateManager: any) {
          stateManagerRef = stateManager;
        },
        async initialize(): Promise<void> {
          state.phase = 'initializing';
          state.startTime = Date.now();
          if (stateManagerRef) {
            stateManagerRef.setLifecyclePhase('initializing');
          }
        },
        async start(): Promise<void> {
          state.phase = 'running';
          if (stateManagerRef) {
            stateManagerRef.setLifecyclePhase('running');
          }
        },
        async stop(): Promise<void> {
          state.phase = 'stopped';
          if (stateManagerRef) {
            stateManagerRef.setLifecyclePhase('stopped');
          }
        },
        async shutdown(): Promise<void> {
          state.phase = 'stopped';
          if (stateManagerRef) {
            stateManagerRef.setLifecyclePhase('stopped');
          }
        },
        getState() {
          return { ...state };
        },
        updatePhase(phase: string): void {
          state.phase = phase;
          if (stateManagerRef) {
            stateManagerRef.setLifecyclePhase(phase);
          }
        },
        registerComponent(id: string): void {
          state.components.add(id);
        },
        unregisterComponent(id: string): boolean {
          const wasRegistered = state.components.has(id);
          state.components.delete(id);
          return wasRegistered;
        },
        pushScreen(screenId: string): void {
          state.screens.push(screenId);
        },
        popScreen(): string | undefined {
          return state.screens.pop();
        },
        isRunning(): boolean {
          return state.phase === 'running';
        },
        onStateChange(callback: (state: any) => void): void {
          // Mock implementation
        },
        registerHooks(hooks: any): void {
          // Mock implementation
        },
        displaySplashScreen(): void {
          // Mock implementation
        },
        handleInitializationError(error: Error): Promise<void> {
          // Don't change phase during error handling in tests
          return Promise.resolve();
        },
        updateLayoutDimensions(width: number, height: number): void {
          // Mock implementation
        },
        handleError(error: Error): void {
          // Don't change state to stopped during error handling - keep current phase
        },
        handleSignal(signalType: string): void {
          // Mock implementation
        }
      };
    });

    // SplitPaneLayout
    this.register<ISplitPaneLayout>('splitPaneLayout', () => ({
      getLeftPanelContent(): string[] {
        return ['Mock left panel content'];
      },
      getRightPanelContent(): string[] {
        return ['Mock right panel content'];
      },
      render(leftContent: string[], rightContent: string[]): string {
        return 'Mock layout output';
      },
      initialize(): void {
        // Mock implementation
      },
      updateDimensions(): void {
        // Mock implementation
      },
      async cleanup(): Promise<void> {
        // Mock implementation
      }
    }));

    // InputRouter
    this.register<IInputRouter>('inputRouter', () => ({
      initialize(): void {
        // Mock implementation
      },
      routeInput(input: any): void {
        // Mock implementation
      },
      async cleanup(): Promise<void> {
        // Mock implementation
      },
      async onShutdown(): Promise<void> {
        // Mock implementation
      }
    }));

    // ShutdownManager
    this.register<IShutdownManager>('shutdownManager', () => ({
      async onInitialize(): Promise<void> {
        // Mock implementation
      },
      async onShutdown(): Promise<void> {
        // Mock implementation
      },
      registerHooks(): void {
        // Mock implementation
      },
      async executeGracefulShutdown(reason?: string): Promise<any> {
        return {
          duration: 100,
          stepsCompleted: 3,
          stepsFailed: 0,
          steps: [],
          forceShutdown: false,
          timeoutReached: false
        };
      }
    }));

    // ErrorBoundary
    this.register<IErrorBoundary>('errorBoundary', () => ({
      initialize(): void {
        // Mock implementation
      },
      handleError(): void {
        // Mock implementation
      },
      recover(): void {
        // Mock implementation
      },
      async execute(fn: () => Promise<void>): Promise<void> {
        await fn();
      },
      async handleApplicationError(error: Error, context: any): Promise<void> {
        // Mock implementation
      }
    }));

    // PanicRecovery
    this.register<IPanicRecovery>('panicRecovery', () => ({
      setApplicationShell(shell: any): void {
        // Mock implementation
      },
      setLogger(logger: any): void {
        // Mock implementation
      },
      initialize(): void {
        // Mock implementation
      },
      async handlePanic(error: Error): Promise<void> {
        // Mock implementation
      },
      async attemptRecovery(): Promise<boolean> {
        return true;
      }
    }));

    // PerformanceMonitor
    this.register<IPerformanceMonitor>('performanceMonitor', () => ({
      startSampling(): void {
        // Mock implementation
      },
      stopSampling(): void {
        // Mock implementation
      },
      getMetrics(): any {
        return {
          memoryUsage: 50 * 1024 * 1024,
          cpuUsage: 25,
          timestamp: Date.now()
        };
      },
      startProfiling(name: string): void {
        // Mock implementation
      },
      endProfiling(name: string): number {
        return 10;
      },
      getConfig(): any {
        return { enableMetrics: true };
      }
    }));

    // TerminalManager
    this.register<ITerminalManager>('terminalManager', () => ({
      getDimensions(): { width: number; height: number } {
        return { width: 80, height: 24 };
      },
      hasCapability(name: string): boolean {
        return name === 'color' || name === 'unicode';
      },
      detectCapabilities(): any {
        return {
          supportsColor: true,
          supportsUnicode: true,
          supportsMouse: false,
          supportsAltScreen: false
        };
      },
      setupTerminal(): void {
        // Mock implementation
      },
      async cleanup(): Promise<void> {
        // Mock implementation
      }
    }));

    // ApplicationShellMethods
    this.register<IApplicationShellMethods>('methods', () => ({
      pushScreen(screen: any): void {
        // Mock implementation
      },
      popScreen(): any {
        return null;
      },
      replaceScreen(screen: any): void {
        // Mock implementation
      },
      getCurrentScreen(): any {
        return null;
      },
      on(event: string, handler: Function): void {
        // Mock implementation
      },
      off(event: string, handler: Function): void {
        // Mock implementation
      },
      emit(event: string, data?: any): void {
        // Mock implementation
      },
      registerComponent(name: string, component: any): void {
        // Mock implementation
      },
      createComponent(name: string, props: Record<string, unknown>): any {
        return { name, props };
      },
      getTerminalSize(): { width: number; height: number } {
        return { width: 80, height: 24 };
      },
      isTerminalCapable(capability: string): boolean {
        return capability === 'color' || capability === 'unicode';
      },
      getMetrics(): any {
        return {
          startupTime: 50,
          memoryUsage: 1024 * 1024,
          renderTime: 25
        };
      },
      startProfiling(name: string): void {
        // Mock implementation
      },
      endProfiling(name: string): number {
        return 10;
      },
      getState(): any {
        return {
          version: '1.0.0',
          mode: 'tui',
          terminal: {
            supportsColor: true,
            supportsUnicode: true,
            width: 80,
            height: 24
          },
          layout: {
            type: 'split-pane',
            ratio: 0.7,
            leftPanel: { width: 56, height: 24, content: [] },
            rightPanel: { width: 24, height: 24, content: [] }
          },
          focus: {
            activePanel: 'left',
            focusHistory: []
          }
        };
      },
      getLifecycleState(): any {
        return {
          phase: 'stopped',
          startTime: 0,
          components: new Set(),
          screens: [],
          errorState: undefined
        };
      },
      getPerformanceReport(): any {
        return {
          startupTime: 50,
          memoryUsage: 1024 * 1024,
          renderTime: 25,
          timestamp: Date.now()
        };
      },
      handleInput(input: any): void {
        // Mock implementation
      },
      handleResize(width: number, height: number): void {
        // Mock implementation
      },
      handleSignal(signalType: string): void {
        // Mock implementation
      },
      handleError(error: Error): void {
        // Mock implementation
      }
    }));

    // ApplicationShellRenderer
    this.register<IApplicationShellRenderer>('renderer', () => ({
      render(): void {
        // Mock implementation - don't actually write to stdout in tests
      }
    }));

    // Other mock dependencies
    this.register('applicationLoop', () => ({
      setupInputHandling(): void {},
      setupSignalHandlers(): void {},
      on(event: string, handler: Function): void {},
      off(event: string, handler: Function): void {},
      emit(event: string, data?: unknown): void {}
    }));

    this.register('uiFramework', () => ({
      initialize: () => {},
      screens: { registerScreen: () => {} },
      components: { registerComponent: () => {} }
    }));

    this.register('screens', () => ({
      registerScreen: () => {}
    }));

    this.register('components', () => ({
      registerComponent: () => {}
    }));

    this.register('ui', () => ({
      setup: () => {}
    }));

    this.register('stateManager', () => {
      let lifecycleState = {
        phase: 'stopped',
        startTime: 0,
        components: new Set(),
        screens: [],
        errorState: undefined
      };
      let applicationState = {
        version: '1.0.0',
        mode: 'tui',
        terminal: {
          supportsColor: true,
          supportsUnicode: true,
          width: 80,
          height: 24
        },
        layout: {
          type: 'split-pane',
          ratio: 0.7,
          leftPanel: { width: 56, height: 24, content: [] },
          rightPanel: { width: 24, height: 24, content: [] }
        },
        focus: {
          activePanel: 'left',
          focusHistory: []
        }
      };
      return {
        getState() {
          return { ...applicationState };
        },
        getLifecycleState() {
          return { ...lifecycleState };
        },
        updateState() {
          // Mock implementation
        },
        setLifecyclePhase(phase: string) {
          lifecycleState.phase = phase;
          lifecycleState.startTime = Date.now();
        }
      };
    });

    this.register('state', () => {
      let state = {
        phase: 'stopped',
        startTime: 0,
        components: new Set(),
        screens: [],
        errorState: undefined
      };
      return {
        get phase() { return state.phase; },
        set phase(newPhase: string) { state.phase = newPhase; },
        get startTime() { return state.startTime; },
        get components() { return state.components; },
        get screens() { return state.screens; },
        get errorState() { return state.errorState; },
        update: (newState: Partial<typeof state>) => {
          state = { ...state, ...newState };
        }
      };
    });

    this.register('eventHandler', () => ({}));

    this.register('lifecycle', () => ({
      initialize: () => {},
      shutdown: () => {}
    }));

    this.register('events', () => {
      const eventHandlers = new Map<string, Function[]>();
      return {
        on(event: string, handler: Function): void {
          if (!eventHandlers.has(event)) {
            eventHandlers.set(event, []);
          }
          eventHandlers.get(event)!.push(handler);
        },
        off(event: string, handler: Function): void {
          const handlers = eventHandlers.get(event);
          if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
              handlers.splice(index, 1);
            }
          }
        },
        emit(event: string, data?: unknown): void {
          const handlers = eventHandlers.get(event);
          if (handlers) {
            handlers.forEach(handler => handler(data));
          }
        },
        emitError(error: Error): void {
          const handlers = eventHandlers.get('error');
          if (handlers) {
            handlers.forEach(handler => handler(error));
          }
        },
        emitLifecycleStateChanged(state: any): void {
          const handlers = eventHandlers.get('lifecycleStateChanged');
          if (handlers) {
            handlers.forEach(handler => handler(state));
          }
        },
        emitPerformanceAlert(alert: any): void {
          const handlers = eventHandlers.get('performanceAlert');
          if (handlers) {
            handlers.forEach(handler => handler(alert));
          }
        }
      };
    });

    this.register('performance', () => ({}));

    this.register('rendering', () => ({}));

    this.register('startup', () => ({
      initializeSubsystems: async (
        terminalManager: any,
        splitPaneLayout: any,
        inputRouter: any,
        shutdownManager: any
      ): Promise<void> => {
        // Mock implementation
      },
      start: async (applicationLoop: any, renderCallback: () => void): Promise<void> => {
        // Mock implementation
      },
      stop: async (applicationLoop: any): Promise<void> => {
        // Mock implementation
      },
      recordStartupMetrics: (startTime: number): void => {
        // Mock implementation
      }
    }));

    this.register('lifecycle', () => ({
      initialize: () => {},
      shutdown: () => {},
      displaySplashScreen: () => {},
      handleInitializationError: async (error: Error): Promise<void> => {},
      updateLayoutDimensions: (width: number, height: number) => {},
      handleError: (error: Error) => {},
      handleSignal: (signalType: string) => {}
    }));
  }

  // Reset all singleton instances
  reset(): void {
    this.singletons.clear();
  }
}

// Factory function to create IOC container with config
export function createApplicationShellIOC(config: ApplicationShellConfig) {
  const container = new ApplicationShellIOC();

  // Register config-specific services
  container.register('splitPaneLayout', () => ({
    getLeftPanelContent(): string[] {
      return ['Mock left panel content'];
    },
    getRightPanelContent(): string[] {
      return ['Mock right panel content'];
    },
    render(leftContent: string[], rightContent: string[]): string {
      return 'Mock layout output';
    },
    initialize(): void {
      // Mock implementation
    },
    updateDimensions(): void {
      // Mock implementation
    },
    async cleanup(): Promise<void> {
      // Mock implementation
    }
  }), false);

  return container;
}