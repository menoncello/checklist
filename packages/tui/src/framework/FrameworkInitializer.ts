import { ComponentRegistry } from '../components/ComponentRegistry';
import { DebugIntegration } from '../debug';
import { ErrorBoundary } from '../errors/ErrorBoundary';
import { EventManager } from '../events/EventManager';
import { KeyboardHandler } from '../events/KeyboardHandler';
import { PerformanceManager } from '../performance';
import { ScreenManager } from '../screens/ScreenManager';
import { CapabilityDetector } from '../terminal/CapabilityDetector';
import { ApplicationLoop } from './ApplicationLoop';
import { LifecycleManager } from './Lifecycle';
import { TerminalCanvas } from './TerminalCanvas';

export interface InitializationContext {
  performanceManager?: PerformanceManager;
  debugIntegration?: DebugIntegration;
  capabilityDetector?: CapabilityDetector;
  canvas?: TerminalCanvas;
  errorBoundary?: ErrorBoundary;
  componentRegistry?: ComponentRegistry;
  eventManager?: EventManager;
  keyboardHandler?: KeyboardHandler;
  screenManager?: ScreenManager;
  lifecycle?: LifecycleManager;
  applicationLoop?: ApplicationLoop;
}

export interface TUIFrameworkConfig {
  enableFramework: boolean;
  targetFPS: number;
  enablePerformanceMonitoring: boolean;
  performanceTargets: {
    startupTime: number;
    renderTime: number;
    memoryLimit: number;
  };
  enableDebugMode: boolean;
  debugInProduction: boolean;
  enableErrorBoundaries: boolean;
  enableCrashRecovery: boolean;
  enableTerminalDetection: boolean;
  fallbackToBasic: boolean;
  enableKeyboardShortcuts: boolean;
  enableMouseSupport: boolean;
}

export class FrameworkInitializer {
  private config: TUIFrameworkConfig;
  private startTime: number;

  constructor(config: TUIFrameworkConfig) {
    this.config = config;
    this.startTime = 0;
  }

  async initialize(): Promise<InitializationContext> {
    this.startTime = performance.now();
    const context: InitializationContext = {};

    try {
      await this.initializePerformanceMonitoring(context);
      await this.initializeDebugIntegration(context);
      await this.initializeTerminalCapabilities(context);
      await this.initializeCanvas(context);
      await this.initializeErrorBoundary(context);
      await this.initializeCoreComponents(context);

      this.finalizeInitialization(context);
      return context;
    } catch (error) {
      context.debugIntegration?.log(
        'error',
        'Framework',
        'Framework initialization failed',
        error
      );
      throw error;
    }
  }

  private async initializePerformanceMonitoring(
    context: InitializationContext
  ): Promise<void> {
    if (!this.config.enablePerformanceMonitoring) return;

    context.performanceManager = new PerformanceManager({
      enableMonitoring: true,
      startupProfiling: true,
      enableMemoryTracking: true,
      enableMetricsCollection: true,
    });

    // Start performance monitoring for framework initialization
    context.performanceManager.start();
  }

  private async initializeDebugIntegration(
    context: InitializationContext
  ): Promise<void> {
    if (!this.config.enableDebugMode) return;

    context.debugIntegration = new DebugIntegration({
      enableInProduction: this.config.debugInProduction,
      enablePerformanceIntegration: this.config.enablePerformanceMonitoring,
    });

    if (context.performanceManager) {
      context.debugIntegration.setPerformanceManager(
        context.performanceManager
      );
    }

    context.debugIntegration.log(
      'info',
      'Framework',
      'TUI Framework initialization started'
    );
  }

  private async initializeTerminalCapabilities(
    context: InitializationContext
  ): Promise<void> {
    if (!this.config.enableTerminalDetection) return;

    context.capabilityDetector = new CapabilityDetector();
    await context.capabilityDetector.detect();

    context.debugIntegration?.log(
      'info',
      'Terminal',
      'Terminal capabilities detected'
    );
  }

  private async initializeCanvas(
    context: InitializationContext
  ): Promise<void> {
    context.canvas = new TerminalCanvas();
  }

  private async initializeErrorBoundary(
    context: InitializationContext
  ): Promise<void> {
    if (!this.config.enableErrorBoundaries) return;

    context.errorBoundary = new ErrorBoundary({
      maxRetries: 3,
      retryDelay: 1000,
      logErrors: true,
      enableStatePreservation: true,
      fallbackRenderer: (error: Error) => `Error: ${error.message}`,
    });

    context.errorBoundary.on('errorCaught', (data: unknown) => {
      context.debugIntegration?.log(
        'error',
        'Framework',
        'Error caught by boundary',
        data
      );
    });
  }

  private async initializeCoreComponents(
    context: InitializationContext
  ): Promise<void> {
    // Initialize component registry
    context.componentRegistry = new ComponentRegistry();

    // Initialize event system
    context.eventManager = new EventManager();
    context.keyboardHandler = new KeyboardHandler();

    // Initialize screen manager
    context.screenManager = new ScreenManager({
      enableTransitions: true,
      enableHistory: true,
      transitionDuration: 300,
      maxStackSize: 10,
      historySize: 50,
    });

    // Initialize lifecycle manager
    context.lifecycle = new LifecycleManager();

    // Initialize application loop
    context.applicationLoop = new ApplicationLoop(this.config.targetFPS);
  }

  private finalizeInitialization(context: InitializationContext): void {
    const initializationTime = performance.now() - this.startTime;

    if (context.performanceManager) {
      context.performanceManager.markStartupPhaseComplete('framework_init');
    }

    context.debugIntegration?.log(
      'info',
      'Framework',
      `TUI Framework initialized in ${initializationTime.toFixed(2)}ms`
    );
  }

  getInitializationTime(): number {
    return performance.now() - this.startTime;
  }
}
