import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { ApplicationShellInitializers } from '../../src/application/ApplicationShellInitializers';
import { ApplicationShellConfig, ApplicationState } from '../../src/application/ApplicationShellConfig';

// Mock all the classes
const mockLifecycleManagerClass = mock(() => ({
  setupShutdownHandlers: mock(() => {}),
}));

const mockApplicationLoopClass = mock(() => ({
  setupInputHandling: mock(() => {}),
  setupSignalHandlers: mock(() => {}),
}));

const mockPerformanceMonitorClass = mock(() => ({
  startSampling: mock(() => {}),
  stopSampling: mock(() => {}),
  getMetrics: mock(() => ({})),
}));

const mockTerminalManagerClass = mock(() => ({
  detectCapabilities: mock(() => ({})),
  setupTerminal: mock(() => {}),
  cleanup: mock(() => {}),
}));

const mockSplitPaneLayoutClass = mock(() => ({
  initialize: mock(() => {}),
  updateDimensions: mock(() => {}),
  render: mock(() => ''),
}));

const mockInputRouterClass = mock(() => ({
  initialize: mock(() => {}),
  routeInput: mock(() => {}),
  cleanup: mock(() => {}),
}));

const mockShutdownManagerClass = mock(() => ({
  onInitialize: mock(() => Promise.resolve()),
  onShutdown: mock(() => Promise.resolve()),
  registerHooks: mock(() => {}),
}));

const mockErrorBoundaryClass = mock(() => ({
  initialize: mock(() => {}),
  handleError: mock(() => {}),
  recover: mock(() => {}),
}));

const mockPanicRecoveryClass = mock(() => ({
  initialize: mock(() => {}),
  handlePanic: mock(() => {}),
  recover: mock(() => {}),
}));

// Mock the modules
mock.module('../../src/framework/Lifecycle', () => ({
  LifecycleManager: mockLifecycleManagerClass,
}));

mock.module('../../src/framework/ApplicationLoop', () => ({
  ApplicationLoop: mockApplicationLoopClass,
}));

mock.module('../../src/performance/PerformanceMonitorSlim', () => ({
  PerformanceMonitor: mockPerformanceMonitorClass,
}));

mock.module('../../src/terminal/TerminalManager', () => ({
  TerminalManager: mockTerminalManagerClass,
}));

mock.module('../../src/layout/SplitPaneLayout', () => ({
  SplitPaneLayout: mockSplitPaneLayoutClass,
}));

mock.module('../../src/input/InputRouter', () => ({
  InputRouter: mockInputRouterClass,
}));

mock.module('../../src/application/ShutdownManager', () => ({
  ShutdownManager: mockShutdownManagerClass,
}));

mock.module('../../src/errors/ErrorBoundary', () => ({
  ErrorBoundary: mockErrorBoundaryClass,
}));

mock.module('../../src/errors/PanicRecovery', () => ({
  PanicRecovery: mockPanicRecoveryClass,
}));

// Mock UI framework classes
const mockApplicationShellUIFrameworkClass = mock(() => ({
  initialize: mock(() => {}),
}));
const mockApplicationShellScreensClass = mock(() => ({
  registerScreen: mock(() => {}),
}));
const mockApplicationShellComponentsClass = mock(() => ({
  registerComponent: mock(() => {}),
}));
const mockApplicationShellUIClass = mock(() => ({
  setup: mock(() => {}),
}));
const mockApplicationShellStateClass = mock(() => ({
  updateState: mock(() => {}),
}));
const mockApplicationShellMethodsClass = mock(() => ({
  execute: mock(() => {}),
}));

mock.module('../../src/application/ApplicationShellUIFramework', () => ({
  ApplicationShellUIFramework: mockApplicationShellUIFrameworkClass,
}));

mock.module('../../src/application/ApplicationShellScreens', () => ({
  ApplicationShellScreens: mockApplicationShellScreensClass,
}));

mock.module('../../src/application/ApplicationShellComponents', () => ({
  ApplicationShellComponents: mockApplicationShellComponentsClass,
}));

mock.module('../../src/application/ApplicationShellUI', () => ({
  ApplicationShellUI: mockApplicationShellUIClass,
}));

mock.module('../../src/application/ApplicationShellState', () => ({
  ApplicationShellState: mockApplicationShellStateClass,
}));

mock.module('../../src/application/ApplicationShellMethods', () => ({
  ApplicationShellMethods: mockApplicationShellMethodsClass,
}));

// Mock all the dependencies
const mockTerminalManager = {
  detectCapabilities: mock(() => ({})),
  setupTerminal: mock(() => {}),
  cleanup: mock(() => {}),
};

const mockPerformanceMonitor = {
  startSampling: mock(() => {}),
  stopSampling: mock(() => {}),
  getMetrics: mock(() => ({})),
};

const mockSplitPaneLayout = {
  initialize: mock(() => {}),
  updateDimensions: mock(() => {}),
  render: mock(() => ''),
};

const mockInputRouter = {
  initialize: mock(() => {}),
  routeInput: mock(() => {}),
  cleanup: mock(() => {}),
};

const mockShutdownManager = {
  onInitialize: mock(() => Promise.resolve()),
  onShutdown: mock(() => Promise.resolve()),
  registerHooks: mock(() => {}),
};

const mockErrorBoundary = {
  initialize: mock(() => {}),
  handleError: mock(() => {}),
  recover: mock(() => {}),
};

const mockPanicRecovery = {
  initialize: mock(() => {}),
  handlePanic: mock(() => {}),
  recover: mock(() => {}),
};

describe('ApplicationShellInitializers', () => {
  let initializers: ApplicationShellInitializers;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    // Store original NODE_ENV
    originalNodeEnv = Bun.env.NODE_ENV;

    // Create new instance
    initializers = new ApplicationShellInitializers();

    // Reset all mocks
    mockTerminalManager.detectCapabilities.mockRestore();
    mockTerminalManager.setupTerminal.mockRestore();
    mockTerminalManager.cleanup.mockRestore();
    mockPerformanceMonitor.startSampling.mockRestore();
    mockPerformanceMonitor.stopSampling.mockRestore();
    mockPerformanceMonitor.getMetrics.mockRestore();
    mockSplitPaneLayout.initialize.mockRestore();
    mockSplitPaneLayout.updateDimensions.mockRestore();
    mockSplitPaneLayout.render.mockRestore();
    mockInputRouter.initialize.mockRestore();
    mockInputRouter.routeInput.mockRestore();
    mockInputRouter.cleanup.mockRestore();
    mockShutdownManager.onInitialize.mockRestore();
    mockShutdownManager.onShutdown.mockRestore();
    mockShutdownManager.registerHooks.mockRestore();
    mockErrorBoundary.initialize.mockRestore();
    mockErrorBoundary.handleError.mockRestore();
    mockErrorBoundary.recover.mockRestore();
    mockPanicRecovery.initialize.mockRestore();
    mockPanicRecovery.handlePanic.mockRestore();
    mockPanicRecovery.recover.mockRestore();
  });

  afterEach(() => {
    // Restore original NODE_ENV
    if (originalNodeEnv !== undefined) {
      Bun.env.NODE_ENV = originalNodeEnv;
    } else {
      delete Bun.env.NODE_ENV;
    }

    // IMPORTANT: Restore all mocked modules to prevent affecting other tests
    mock.restore();
  });

  describe('constructor', () => {
    it('should create instance', () => {
      expect(initializers).toBeDefined();
      expect(initializers).toBeInstanceOf(ApplicationShellInitializers);
    });
  });

  describe('initializeConfig', () => {
    it('should initialize config with defaults', () => {
      const partialConfig: Partial<ApplicationShellConfig> = {
        version: '1.0.0',
      };

      const config = initializers.initializeConfig(partialConfig as ApplicationShellConfig);

      expect(config.version).toBe('1.0.0');
      expect(config.splitRatio).toBe(0.7);
      expect(config.targetFPS).toBe(60);
      expect(config.enableSplashScreen).toBe(true);
      expect(config.enableDebugMode).toBe(false);
    });

    it('should preserve provided config values', () => {
      const config: ApplicationShellConfig = {
        version: '1.0.0',
        splitRatio: 0.6,
        targetFPS: 30,
        enableSplashScreen: false,
        enableDebugMode: true,
      };

      const initialized = initializers.initializeConfig(config as ApplicationShellConfig);

      expect(initialized.splitRatio).toBe(0.6);
      expect(initialized.targetFPS).toBe(30);
      expect(initialized.enableSplashScreen).toBe(false);
      expect(initialized.enableDebugMode).toBe(true);
    });

    it('should handle undefined splitRatio', () => {
      const config: Partial<ApplicationShellConfig> = {
        version: '1.0.0',
        splitRatio: undefined,
      };

      const initialized = initializers.initializeConfig(config as ApplicationShellConfig);

      expect(initialized.splitRatio).toBe(0.7);
    });

    it('should handle null splitRatio', () => {
      const config: Partial<ApplicationShellConfig> = {
        version: '1.0.0',
        splitRatio: null as any,
      };

      const initialized = initializers.initializeConfig(config as ApplicationShellConfig);

      expect(initialized.splitRatio).toBe(0.7);
    });
  });

  describe('initializeState', () => {
    it('should initialize state with default values', () => {
      const config: ApplicationShellConfig = {
        version: '1.0.0',
        splitRatio: 0.6,
      };

      const state = initializers.initializeState(config);

      expect(state.version).toBe('1.0.0');
      expect(state.mode).toBe('tui');
      expect(state.terminal.supportsColor).toBe(false);
      expect(state.terminal.supportsUnicode).toBe(false);
      expect(state.terminal.width).toBe(80);
      expect(state.terminal.height).toBe(24);
      expect(state.layout.type).toBe('split-pane');
      expect(state.layout.ratio).toBe(0.6);
      expect(state.focus.activePanel).toBe('left');
      expect(state.focus.focusHistory).toEqual([]);
      expect(state.layout.leftPanel.content).toEqual([]);
      expect(state.layout.rightPanel.content).toEqual([]);
    });

    it('should use default splitRatio when not provided', () => {
      const config: ApplicationShellConfig = {
        version: '1.0.0',
        splitRatio: undefined as any,
      };

      const state = initializers.initializeState(config);

      expect(state.layout.ratio).toBe(0.7);
    });
  });

  describe('initializeCoreManagers', () => {
    beforeEach(() => {
      // Reset all mock calls
      mockLifecycleManagerClass.mockClear();
      mockApplicationLoopClass.mockClear();
      mockPerformanceMonitorClass.mockClear();
    });

    it('should initialize core managers with test config in test environment', () => {
      Bun.env.NODE_ENV = 'test';

      const config: ApplicationShellConfig = {
        version: '1.0.0',
        targetFPS: 30,
      };

      const managers = initializers.initializeCoreManagers(config);

      expect(managers.lifecycleManager).toBeDefined();
      expect(managers.applicationLoop).toBeDefined();
      expect(managers.performanceMonitor).toBeDefined();

      // Verify constructors were called
      expect(mockLifecycleManagerClass).toHaveBeenCalled();
      expect(mockApplicationLoopClass).toHaveBeenCalledWith(30);
      expect(mockPerformanceMonitorClass).toHaveBeenCalledWith(
        expect.objectContaining({
          enableAutoSampling: false,
          samplingInterval: 60000,
          enableMemoryProfiling: false,
          enableCPUProfiling: false,
        })
      );
    });

    it('should initialize core managers with production config in production environment', () => {
      Bun.env.NODE_ENV = 'production';

      const config: ApplicationShellConfig = {
        version: '1.0.0',
        targetFPS: 30,
        performanceConfig: {
          enableAutoSampling: true,
          samplingInterval: 5000,
          enableMemoryProfiling: true,
          enableCPUProfiling: true,
        },
      };

      const managers = initializers.initializeCoreManagers(config);

      expect(managers.lifecycleManager).toBeDefined();
      expect(managers.applicationLoop).toBeDefined();
      expect(managers.performanceMonitor).toBeDefined();

      // Verify production config was preserved
      expect(mockPerformanceMonitorClass).toHaveBeenCalledWith(
        expect.objectContaining({
          enableAutoSampling: true,
          samplingInterval: 5000,
          enableMemoryProfiling: true,
          enableCPUProfiling: true,
        })
      );
    });

    it('should handle missing performance config', () => {
      Bun.env.NODE_ENV = 'test';

      const config: ApplicationShellConfig = {
        version: '1.0.0',
        targetFPS: 30,
      };

      const managers = initializers.initializeCoreManagers(config);

      expect(managers.lifecycleManager).toBeDefined();
      expect(managers.applicationLoop).toBeDefined();
      expect(managers.performanceMonitor).toBeDefined();

      // Verify default test config was applied
      expect(mockPerformanceMonitorClass).toHaveBeenCalledWith(
        expect.objectContaining({
          enableAutoSampling: false,
          samplingInterval: 60000,
          enableMemoryProfiling: false,
          enableCPUProfiling: false,
        })
      );
    });

    it('should pass targetFPS to ApplicationLoop', () => {
      const config: ApplicationShellConfig = {
        version: '1.0.0',
        targetFPS: 45,
      };

      initializers.initializeCoreManagers(config);

      expect(mockApplicationLoopClass).toHaveBeenCalledWith(45);
    });
  });

  describe('initializeTerminalAndLayout', () => {
    beforeEach(() => {
      // Reset all mock calls
      mockTerminalManagerClass.mockClear();
      mockSplitPaneLayoutClass.mockClear();
      mockInputRouterClass.mockClear();
      mockShutdownManagerClass.mockClear();
    });

    it('should initialize terminal and layout managers', () => {
      const config: ApplicationShellConfig = {
        version: '1.0.0',
        splitRatio: 0.6,
      };

      const managers = initializers.initializeTerminalAndLayout(config);

      expect(managers.terminalManager).toBeDefined();
      expect(managers.splitPaneLayout).toBeDefined();
      expect(managers.inputRouter).toBeDefined();
      expect(managers.shutdownManager).toBeDefined();

      expect(mockTerminalManagerClass).toHaveBeenCalled();
      expect(mockSplitPaneLayoutClass).toHaveBeenCalledWith(0.6);
      expect(mockInputRouterClass).toHaveBeenCalled();
      expect(mockShutdownManagerClass).toHaveBeenCalled();
    });

    it('should use default splitRatio when not provided', () => {
      const config: ApplicationShellConfig = {
        version: '1.0.0',
        splitRatio: undefined as any,
      };

      const managers = initializers.initializeTerminalAndLayout(config);

      expect(mockSplitPaneLayoutClass).toHaveBeenCalledWith(0.7);
    });
  });

  describe('initializeErrorHandling', () => {
    beforeEach(() => {
      // Reset all mock calls
      mockErrorBoundaryClass.mockClear();
      mockPanicRecoveryClass.mockClear();
    });

    it('should initialize error handling managers', () => {
      const config: ApplicationShellConfig = {
        version: '1.0.0',
        errorBoundaryConfig: {
          maxErrors: 10,
          recoveryStrategies: [],
        },
      };

      const managers = initializers.initializeErrorHandling(config);

      expect(managers.errorBoundary).toBeDefined();
      expect(managers.panicRecovery).toBeDefined();

      expect(mockErrorBoundaryClass).toHaveBeenCalledWith(config.errorBoundaryConfig);
      expect(mockPanicRecoveryClass).toHaveBeenCalledWith(managers.errorBoundary);
    });

    it('should handle undefined error boundary config', () => {
      const config: ApplicationShellConfig = {
        version: '1.0.0',
        errorBoundaryConfig: undefined,
      };

      const managers = initializers.initializeErrorHandling(config);

      expect(mockErrorBoundaryClass).toHaveBeenCalledWith(undefined);
      expect(mockPanicRecoveryClass).toHaveBeenCalledWith(managers.errorBoundary);
    });
  });

  describe('createDependencies', () => {
    beforeEach(() => {
      // Reset all mock calls
      mockLifecycleManagerClass.mockClear();
      mockApplicationLoopClass.mockClear();
      mockPerformanceMonitorClass.mockClear();
      mockTerminalManagerClass.mockClear();
      mockSplitPaneLayoutClass.mockClear();
      mockInputRouterClass.mockClear();
      mockShutdownManagerClass.mockClear();
      mockErrorBoundaryClass.mockClear();
      mockPanicRecoveryClass.mockClear();
    });

    it('should create all dependencies', () => {
      const config: ApplicationShellConfig = {
        version: '1.0.0',
        splitRatio: 0.6,
        targetFPS: 30,
      };

      const dependencies = initializers.createDependencies(config);

      // Check that all required dependencies are present
      expect(dependencies.config).toBeDefined();
      expect(dependencies.state).toBeDefined();
      expect(dependencies.lifecycleManager).toBeDefined();
      expect(dependencies.applicationLoop).toBeDefined();
      expect(dependencies.performanceMonitor).toBeDefined();
      expect(dependencies.terminalManager).toBeDefined();
      expect(dependencies.splitPaneLayout).toBeDefined();
      expect(dependencies.inputRouter).toBeDefined();
      expect(dependencies.shutdownManager).toBeDefined();
      expect(dependencies.errorBoundary).toBeDefined();
      expect(dependencies.panicRecovery).toBeDefined();
      expect(dependencies.rendering).toBeDefined();
      expect(dependencies.eventHandler).toBeDefined();
      expect(dependencies.lifecycle).toBeDefined();
      expect(dependencies.renderer).toBeDefined();
      expect(dependencies.events).toBeDefined();
      expect(dependencies.performance).toBeDefined();
      expect(dependencies.startup).toBeDefined();
      expect(dependencies.uiFramework).toBeDefined();
      expect(dependencies.screens).toBeDefined();
      expect(dependencies.components).toBeDefined();
      expect(dependencies.ui).toBeDefined();
      expect(dependencies.stateManager).toBeDefined();
      expect(dependencies.methods).toBeDefined();
    });

    it('should properly initialize all components', () => {
      const config: ApplicationShellConfig = {
        version: '1.0.0',
        splitRatio: 0.6,
        targetFPS: 30,
      };

      const deps = initializers.createDependencies(config);

      // Verify dependencies were created
      expect(deps).toBeDefined();
      expect(deps.lifecycleManager).toBeDefined();
      expect(deps.applicationLoop).toBeDefined();
      expect(deps.performanceMonitor).toBeDefined();
      expect(deps.terminalManager).toBeDefined();
      expect(deps.splitPaneLayout).toBeDefined();
      expect(deps.inputRouter).toBeDefined();
      expect(deps.shutdownManager).toBeDefined();
      expect(deps.errorBoundary).toBeDefined();
      expect(deps.panicRecovery).toBeDefined();
    });

    it('should integrate all components properly', () => {
      const config: ApplicationShellConfig = {
        version: '1.0.0',
        splitRatio: 0.6,
        targetFPS: 30,
      };

      const dependencies = initializers.createDependencies(config);

      // Verify config and state are properly initialized
      expect(dependencies.config.version).toBe('1.0.0');
      expect(dependencies.config.splitRatio).toBe(0.6);
      expect(dependencies.config.targetFPS).toBe(30);
      expect(dependencies.state.version).toBe('1.0.0');
      expect(dependencies.state.layout.ratio).toBe(0.6);

      // Verify that helper classes are properly integrated
      expect(dependencies.rendering).toBeDefined();
      expect(dependencies.eventHandler).toBeDefined();
      expect(dependencies.lifecycle).toBeDefined();
    });
  });

  describe('helper class initialization', () => {
    it('should create helper context correctly', () => {
      const state: ApplicationState = {
        version: '1.0.0',
        mode: 'tui',
        terminal: { supportsColor: false, supportsUnicode: false, width: 80, height: 24 },
        layout: { type: 'split-pane', ratio: 0.7, leftPanel: { width: 0, height: 0, content: [] }, rightPanel: { width: 0, height: 0, content: [] } },
        focus: { activePanel: 'left', focusHistory: [] },
      };

      const context = (initializers as any).createHelperContext(state, mockSplitPaneLayout, mockPerformanceMonitor);

      expect(context.state).toBe(state);
      expect(context.splitPaneLayout).toBe(mockSplitPaneLayout);
      expect(context.performanceMonitor).toBe(mockPerformanceMonitor);
    });

    it('should create startup dependencies correctly', () => {
      const config: ApplicationShellConfig = {
        version: '1.0.0',
      };

      const startupDeps = (initializers as any).createStartupDependencies(
        config,
        mockErrorBoundary,
        mockPanicRecovery,
        { setupShutdownHandlers: mock(() => {}) }
      );

      expect(startupDeps.config).toBe(config);
      expect(startupDeps.errorBoundary).toBe(mockErrorBoundary);
      expect(startupDeps.panicRecovery).toBe(mockPanicRecovery);
      expect(startupDeps.lifecycleManager).toBeDefined();
    });

    it('should create basic helpers', () => {
      const state: ApplicationState = {
        version: '1.0.0',
        mode: 'tui',
        terminal: { supportsColor: false, supportsUnicode: false, width: 80, height: 24 },
        layout: { type: 'split-pane', ratio: 0.7, leftPanel: { width: 0, height: 0, content: [] }, rightPanel: { width: 0, height: 0, content: [] } },
        focus: { activePanel: 'left', focusHistory: [] },
      };

      const helpers = (initializers as any).createBasicHelpers(state);

      expect(helpers.rendering).toBeDefined();
      expect(helpers.eventHandler).toBeDefined();
      expect(helpers.lifecycle).toBeDefined();
      expect(helpers.events).toBeDefined();
    });

    it('should create advanced helpers', () => {
      const context = {
        state: {
          version: '1.0.0',
          mode: 'tui',
          terminal: { supportsColor: false, supportsUnicode: false, width: 80, height: 24 },
          layout: { type: 'split-pane', ratio: 0.7, leftPanel: { width: 0, height: 0, content: [] }, rightPanel: { width: 0, height: 0, content: [] } },
          focus: { activePanel: 'left', focusHistory: [] },
        },
        splitPaneLayout: mockSplitPaneLayout,
        performanceMonitor: mockPerformanceMonitor,
      };

      const startupDeps = {
        config: { version: '1.0.0' },
        errorBoundary: mockErrorBoundary,
        panicRecovery: mockPanicRecovery,
        lifecycleManager: { setupShutdownHandlers: mock(() => {}) },
        performanceMonitor: mockPerformanceMonitor,
      };

      const helpers = (initializers as any).createAdvancedHelpers(context, startupDeps);

      expect(helpers.renderer).toBeDefined();
      expect(helpers.performance).toBeDefined();
      expect(helpers.startup).toBeDefined();
    });

    it('should combine basic and advanced helpers', () => {
      const context = {
        state: {
          version: '1.0.0',
          mode: 'tui',
          terminal: { supportsColor: false, supportsUnicode: false, width: 80, height: 24 },
          layout: { type: 'split-pane', ratio: 0.7, leftPanel: { width: 0, height: 0, content: [] }, rightPanel: { width: 0, height: 0, content: [] } },
          focus: { activePanel: 'left', focusHistory: [] },
        },
        splitPaneLayout: mockSplitPaneLayout,
        performanceMonitor: mockPerformanceMonitor,
      };

      const startupDeps = {
        config: { version: '1.0.0' },
        errorBoundary: mockErrorBoundary,
        panicRecovery: mockPanicRecovery,
        lifecycleManager: { setupShutdownHandlers: mock(() => {}) },
        performanceMonitor: mockPerformanceMonitor,
      };

      const helpers = initializers.initializeHelperClasses(context as any, startupDeps as any);

      expect(helpers.rendering).toBeDefined();
      expect(helpers.eventHandler).toBeDefined();
      expect(helpers.lifecycle).toBeDefined();
      expect(helpers.events).toBeDefined();
      expect(helpers.renderer).toBeDefined();
      expect(helpers.performance).toBeDefined();
      expect(helpers.startup).toBeDefined();
    });
  });

  describe('UI framework initialization', () => {
    beforeEach(() => {
      // Reset module mocks
      mockApplicationShellUIFrameworkClass.mockClear();
      mockApplicationShellScreensClass.mockClear();
      mockApplicationShellComponentsClass.mockClear();
      mockApplicationShellUIClass.mockClear();
      mockApplicationShellStateClass.mockClear();
    });

    it('should initialize UI framework components', () => {
      const state: ApplicationState = {
        version: '1.0.0',
        mode: 'tui',
        terminal: { supportsColor: false, supportsUnicode: false, width: 80, height: 24 },
        layout: { type: 'split-pane', ratio: 0.7, leftPanel: { width: 0, height: 0, content: [] }, rightPanel: { width: 0, height: 0, content: [] } },
        focus: { activePanel: 'left', focusHistory: [] },
      };

      const performance = { updateMetrics: mock(() => {}) };
      const lifecycleManager = { setupShutdownHandlers: mock(() => {}) };

      const uiFramework = initializers.initializeUIFramework(
        mockTerminalManager as any,
        performance as any,
        state as any,
        lifecycleManager as any
      );

      expect(uiFramework.uiFramework).toBeDefined();
      expect(uiFramework.screens).toBeDefined();
      expect(uiFramework.components).toBeDefined();
      expect(uiFramework.ui).toBeDefined();
      expect(uiFramework.stateManager).toBeDefined();

      // Verify constructor calls
      expect(mockApplicationShellUIFrameworkClass).toHaveBeenCalled();
      expect(mockApplicationShellScreensClass).toHaveBeenCalled();
      expect(mockApplicationShellComponentsClass).toHaveBeenCalled();
      expect(mockApplicationShellUIClass).toHaveBeenCalledWith(
        mockTerminalManager,
        uiFramework.screens,
        uiFramework.components,
        performance
      );
      expect(mockApplicationShellStateClass).toHaveBeenCalledWith(state, lifecycleManager);
    });
  });

  describe('methods creation', () => {
    beforeEach(() => {
      mockApplicationShellMethodsClass.mockClear();
    });

    it('should create methods with correct dependencies', () => {
      const state: ApplicationState = {
        version: '1.0.0',
        mode: 'tui',
        terminal: { supportsColor: false, supportsUnicode: false, width: 80, height: 24 },
        layout: { type: 'split-pane', ratio: 0.7, leftPanel: { width: 0, height: 0, content: [] }, rightPanel: { width: 0, height: 0, content: [] } },
        focus: { activePanel: 'left', focusHistory: [] },
      };

      const deps = {
        state,
        eventHandler: { handleEvent: mock(() => {}) },
        lifecycle: { updateLifecycle: mock(() => {}) },
        events: { emit: mock(() => {}) },
        ui: { renderUI: mock(() => {}) },
        stateManager: { setState: mock(() => {}) },
        inputRouter: mockInputRouter,
      };

      const methods = (initializers as any).createMethods(deps);

      expect(methods).toBeDefined();
      expect(mockApplicationShellMethodsClass).toHaveBeenCalledWith(deps);
    });
  });

  describe('error handling', () => {
    it.skip('should handle constructor errors gracefully', () => {
      // TODO: This test needs the actual LifecycleManager class to be imported
      // to properly test constructor error handling
      // Skip for now to avoid reference errors
    });

    it('should handle undefined configuration values', () => {
      const config = {
        version: '1.0.0',
        // Other properties are undefined
      } as ApplicationShellConfig;

      expect(() => {
        initializers.initializeConfig(config);
      }).not.toThrow();

      expect(() => {
        initializers.initializeState(config);
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty configuration', () => {
      const config = {} as ApplicationShellConfig;

      expect(() => {
        initializers.initializeConfig(config);
      }).not.toThrow();
    });

    it('should handle configuration with null values', () => {
      const config = {
        version: '1.0.0',
        splitRatio: null,
        targetFPS: null,
      } as any;

      const initialized = initializers.initializeConfig(config as ApplicationShellConfig);

      expect(initialized.splitRatio).toBe(0.7);
      expect(initialized.targetFPS).toBe(60);
    });

    it('should handle negative FPS values', () => {
      const config: ApplicationShellConfig = {
        version: '1.0.0',
        targetFPS: -10,
      };

      // Should handle gracefully without throwing
      expect(() => {
        initializers.initializeCoreManagers(config);
      }).not.toThrow();
    });

    it('should handle very high FPS values', () => {
      const config: ApplicationShellConfig = {
        version: '1.0.0',
        targetFPS: 1000,
      };

      // Should handle gracefully without throwing
      expect(() => {
        initializers.initializeCoreManagers(config);
      }).not.toThrow();
    });

    it('should handle missing NODE_ENV', () => {
      delete Bun.env.NODE_ENV;

      const config: ApplicationShellConfig = {
        version: '1.0.0',
      };

      // Should handle gracefully without throwing
      expect(() => {
        initializers.initializeCoreManagers(config);
      }).not.toThrow();
    });
  });
});