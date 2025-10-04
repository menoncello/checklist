import { ErrorBoundary, ErrorBoundaryConfig } from '../errors/ErrorBoundary';
import { PanicRecovery } from '../errors/PanicRecovery';
import { ApplicationLoop } from '../framework/ApplicationLoop';
import { LifecycleManager } from '../framework/Lifecycle';
import { InputRouter } from '../input/InputRouter';
import { SplitPaneLayout } from '../layout/SplitPaneLayout';
import type { PerformanceMonitorConfig } from '../performance/PerformanceMonitorConfig';
import { PerformanceMonitor } from '../performance/PerformanceMonitorSlim';
import { TerminalManager } from '../terminal/TerminalManager';
import { ApplicationShellComponents } from './ApplicationShellComponents';
import {
  ApplicationState,
  ApplicationShellConfig,
} from './ApplicationShellConfig';
import { ApplicationShellEventHandlers } from './ApplicationShellEventHandlers';
import { ApplicationShellEvents } from './ApplicationShellEvents';
import { ApplicationShellLifecycle } from './ApplicationShellLifecycle';
import { ApplicationShellMethods } from './ApplicationShellMethods';
import { ApplicationShellPerformance } from './ApplicationShellPerformance';
import { ApplicationShellRenderer } from './ApplicationShellRenderer';
import { ApplicationShellRendering } from './ApplicationShellRendering';
import { ApplicationShellScreens } from './ApplicationShellScreens';
import { ApplicationShellStartup } from './ApplicationShellStartup';
import { ApplicationShellState } from './ApplicationShellState';
import { ApplicationShellUI } from './ApplicationShellUI';
import { ApplicationShellUIFramework } from './ApplicationShellUIFramework';
import { ShutdownManager } from './ShutdownManager';

export interface ApplicationShellDependencies {
  config: ApplicationShellConfig;
  lifecycleManager: LifecycleManager;
  applicationLoop: ApplicationLoop;
  performanceMonitor: PerformanceMonitor;
  terminalManager: TerminalManager;
  splitPaneLayout: SplitPaneLayout;
  inputRouter: InputRouter;
  shutdownManager: ShutdownManager;
  errorBoundary: ErrorBoundary;
  panicRecovery: PanicRecovery;
  state: ApplicationState;
  rendering: ApplicationShellRendering;
  eventHandler: ApplicationShellEventHandlers;
  lifecycle: ApplicationShellLifecycle;
  renderer: ApplicationShellRenderer;
  events: ApplicationShellEvents;
  uiFramework: ApplicationShellUIFramework;
  screens: ApplicationShellScreens;
  components: ApplicationShellComponents;
  performance: ApplicationShellPerformance;
  startup: ApplicationShellStartup;
  ui: ApplicationShellUI;
  stateManager: ApplicationShellState;
  methods: ApplicationShellMethods;
}

export class ApplicationShellInitializers {
  private createBaseDependencies(config: ApplicationShellConfig) {
    return {
      config: this.initializeConfig(config),
      state: this.initializeState(config),
    };
  }

  private createAllManagers(config: ApplicationShellConfig) {
    return {
      ...this.initializeCoreManagers(config),
      ...this.initializeTerminalAndLayout(config),
      ...this.initializeErrorHandling(config),
    };
  }

  private buildHelpers(
    base: ReturnType<typeof this.createBaseDependencies>,
    managers: ReturnType<typeof this.createAllManagers>
  ) {
    const hCtx = this.createHelperContext(
      base.state,
      managers.splitPaneLayout,
      managers.performanceMonitor
    );
    const sDeps = this.createStartupDependencies(
      base.config,
      managers.errorBoundary,
      managers.panicRecovery,
      managers.lifecycleManager
    );
    return this.initializeHelperClasses(hCtx, sDeps);
  }

  private buildMethods(
    base: ReturnType<typeof this.createBaseDependencies>,
    helpers: ReturnType<typeof this.initializeHelperClasses>,
    ui: ReturnType<typeof this.initializeUIFramework>,
    managers: ReturnType<typeof this.createAllManagers>
  ) {
    return this.createMethods({
      state: base.state,
      eventHandler: helpers.eventHandler,
      lifecycle: helpers.lifecycle,
      events: helpers.events,
      ui: ui.ui,
      stateManager: ui.stateManager,
      inputRouter: managers.inputRouter,
    });
  }

  public createDependencies(
    config: ApplicationShellConfig
  ): ApplicationShellDependencies {
    const base = this.createBaseDependencies(config);
    const managers = this.createAllManagers(base.config);
    const helpers = this.buildHelpers(base, managers);
    const ui = this.initializeUIFramework(
      managers.terminalManager,
      helpers.performance,
      base.state,
      managers.lifecycleManager
    );
    const methods = this.buildMethods(base, helpers, ui, managers);

    return { ...base, ...managers, ...helpers, ...ui, methods };
  }
  public initializeConfig(
    config: ApplicationShellConfig
  ): ApplicationShellConfig {
    const initializedConfig = {
      splitRatio: 0.7,
      targetFPS: 60,
      enableSplashScreen: true,
      enableDebugMode: false,
      ...config,
    };

    initializedConfig.splitRatio ??= 0.7;
    initializedConfig.targetFPS ??= 60;
    return initializedConfig;
  }

  public initializeState(config: ApplicationShellConfig): ApplicationState {
    return {
      version: config.version,
      mode: 'tui',
      terminal: {
        supportsColor: false,
        supportsUnicode: false,
        width: 80,
        height: 24,
      },
      layout: {
        type: 'split-pane',
        ratio: config.splitRatio ?? 0.7,
        leftPanel: { width: 0, height: 0, content: [] },
        rightPanel: { width: 0, height: 0, content: [] },
      },
      focus: {
        activePanel: 'left',
        focusHistory: [],
      },
    };
  }

  public initializeCoreManagers(config: ApplicationShellConfig): {
    lifecycleManager: LifecycleManager;
    applicationLoop: ApplicationLoop;
    performanceMonitor: PerformanceMonitor;
  } {
    // Use test-friendly performance config for tests
    const isTest = process.env.NODE_ENV === 'test';
    let performanceConfig: undefined | Partial<PerformanceMonitorConfig> =
      undefined;

    if (config.performanceConfig != null) {
      performanceConfig = config.performanceConfig;
    } else if (isTest) {
      performanceConfig = {
        enableAutoSampling: false, // Disable auto-sampling for faster startup in tests
        samplingInterval: 60000, // Reduce sampling frequency in tests
        enableMemoryProfiling: false, // Disable memory profiling in tests
        enableCPUProfiling: false, // Disable CPU profiling in tests
      };
    }

    return {
      lifecycleManager: new LifecycleManager(),
      applicationLoop: new ApplicationLoop(config.targetFPS),
      performanceMonitor: new PerformanceMonitor(performanceConfig),
    };
  }

  public initializeTerminalAndLayout(config: ApplicationShellConfig): {
    terminalManager: TerminalManager;
    splitPaneLayout: SplitPaneLayout;
    inputRouter: InputRouter;
    shutdownManager: ShutdownManager;
  } {
    const initializedConfig = this.initializeConfig(config);
    return {
      terminalManager: new TerminalManager(),
      splitPaneLayout: new SplitPaneLayout(initializedConfig.splitRatio),
      inputRouter: new InputRouter(),
      shutdownManager: new ShutdownManager(),
    };
  }

  public initializeErrorHandling(config: ApplicationShellConfig): {
    errorBoundary: ErrorBoundary;
    panicRecovery: PanicRecovery;
  } {
    const errorBoundary = new ErrorBoundary(
      config.errorBoundaryConfig as Partial<ErrorBoundaryConfig> | undefined
    );
    return { errorBoundary, panicRecovery: new PanicRecovery(errorBoundary) };
  }

  private createHelperContext(
    state: ApplicationState,
    splitPaneLayout: SplitPaneLayout,
    performanceMonitor: PerformanceMonitor
  ) {
    return { state, splitPaneLayout, performanceMonitor };
  }

  private createStartupDependencies(
    config: ApplicationShellConfig,
    errorBoundary: ErrorBoundary,
    panicRecovery: PanicRecovery,
    lifecycleManager: LifecycleManager
  ) {
    return { config, errorBoundary, panicRecovery, lifecycleManager };
  }

  private createBasicHelpers(state: ApplicationState) {
    return {
      rendering: new ApplicationShellRendering(),
      eventHandler: new ApplicationShellEventHandlers(state),
      lifecycle: new ApplicationShellLifecycle(state),
      events: new ApplicationShellEvents(),
    };
  }

  private createAdvancedHelpers(
    context: ReturnType<typeof this.createHelperContext>,
    startupDeps: ReturnType<typeof this.createStartupDependencies>
  ) {
    return {
      renderer: new ApplicationShellRenderer(
        context.splitPaneLayout,
        context.performanceMonitor,
        new ApplicationShellRendering()
      ),
      performance: new ApplicationShellPerformance(context.performanceMonitor),
      startup: new ApplicationShellStartup({
        ...startupDeps,
        performanceMonitor: context.performanceMonitor,
      }),
    };
  }

  public initializeHelperClasses(
    context: ReturnType<typeof this.createHelperContext>,
    startupDeps: ReturnType<typeof this.createStartupDependencies>
  ): {
    rendering: ApplicationShellRendering;
    eventHandler: ApplicationShellEventHandlers;
    lifecycle: ApplicationShellLifecycle;
    renderer: ApplicationShellRenderer;
    events: ApplicationShellEvents;
    performance: ApplicationShellPerformance;
    startup: ApplicationShellStartup;
  } {
    const basic = this.createBasicHelpers(context.state);
    const advanced = this.createAdvancedHelpers(context, startupDeps);
    return { ...basic, ...advanced };
  }

  public initializeUIFramework(
    terminalManager: TerminalManager,
    performance: ApplicationShellPerformance,
    state: ApplicationState,
    lifecycleManager: LifecycleManager
  ): {
    uiFramework: ApplicationShellUIFramework;
    screens: ApplicationShellScreens;
    components: ApplicationShellComponents;
    ui: ApplicationShellUI;
    stateManager: ApplicationShellState;
  } {
    const uiFramework = new ApplicationShellUIFramework();
    const screens = new ApplicationShellScreens();
    const components = new ApplicationShellComponents();
    const ui = new ApplicationShellUI(
      terminalManager,
      screens,
      components,
      performance
    );
    const stateManager = new ApplicationShellState(state, lifecycleManager);

    return {
      uiFramework,
      screens,
      components,
      ui,
      stateManager,
    };
  }

  private createMethods(deps: {
    state: ApplicationState;
    eventHandler: ApplicationShellEventHandlers;
    lifecycle: ApplicationShellLifecycle;
    events: ApplicationShellEvents;
    ui: ApplicationShellUI;
    stateManager: ApplicationShellState;
    inputRouter: InputRouter;
  }): ApplicationShellMethods {
    return new ApplicationShellMethods(deps);
  }
}
