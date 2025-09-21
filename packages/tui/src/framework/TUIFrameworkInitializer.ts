import type { TUIFrameworkConfig, TUIFrameworkState } from '../TUIFramework';
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

export class TUIFrameworkInitializer {
  private performanceManager?: PerformanceManager;
  private debugIntegration?: DebugIntegration;
  private errorBoundary?: ErrorBoundary;
  private capabilityDetector?: CapabilityDetector;
  private canvas!: TerminalCanvas;
  private componentRegistry!: ComponentRegistry;
  private eventManager!: EventManager;
  private keyboardHandler!: KeyboardHandler;
  private screenManager!: ScreenManager;
  private lifecycle!: LifecycleManager;
  private applicationLoop!: ApplicationLoop;

  constructor(
    private config: TUIFrameworkConfig,
    private state: TUIFrameworkState
  ) {}

  async initialize(): Promise<{
    canvas: TerminalCanvas;
    applicationLoop: ApplicationLoop;
    lifecycle: LifecycleManager;
    screenManager: ScreenManager;
    componentRegistry: ComponentRegistry;
    eventManager: EventManager;
    keyboardHandler: KeyboardHandler;
    capabilityDetector?: CapabilityDetector;
    errorBoundary?: ErrorBoundary;
    performanceManager?: PerformanceManager;
    debugIntegration?: DebugIntegration;
  }> {
    const startTime = performance.now();

    await this.performInitialization();
    this.finalizeInitialization(startTime);

    return this.getInitializedComponents();
  }

  private async performInitialization(): Promise<void> {
    await this.initializePerformanceMonitoring();
    this.initializeDebugIntegration();
    await this.initializeTerminalCapabilities();
    this.initializeCanvas();
    await this.initializeErrorBoundary();
  }

  private getInitializedComponents() {
    return {
      canvas: this.canvas,
      applicationLoop: this.applicationLoop,
      lifecycle: this.lifecycle,
      screenManager: this.screenManager,
      componentRegistry: this.componentRegistry,
      eventManager: this.eventManager,
      keyboardHandler: this.keyboardHandler,
      capabilityDetector: this.capabilityDetector,
      errorBoundary: this.errorBoundary,
      performanceManager: this.performanceManager,
      debugIntegration: this.debugIntegration,
    };
  }

  private async initializePerformanceMonitoring(): Promise<void> {
    if (!this.config.enablePerformanceMonitoring) return;

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

  private initializeDebugIntegration(): void {
    if (!this.config.enableDebugMode) return;

    this.debugIntegration = new DebugIntegration({
      enableInProduction: this.config.debugInProduction,
      enablePerformanceIntegration: this.config.enablePerformanceMonitoring,
    });

    if (this.performanceManager) {
      this.debugIntegration.setPerformanceManager(this.performanceManager);
    }

    this.debugIntegration.log(
      'info',
      'Framework',
      'TUI Framework initialization started'
    );
  }

  private async initializeTerminalCapabilities(): Promise<void> {
    if (!this.config.enableTerminalDetection) return;

    this.capabilityDetector = new CapabilityDetector();
    await this.capabilityDetector.detect();

    this.debugIntegration?.log(
      'info',
      'Terminal',
      'Terminal capabilities detected'
    );
  }

  private initializeCanvas(): void {
    this.canvas = new TerminalCanvas();
  }

  private async initializeErrorBoundary(): Promise<void> {
    if (!this.config.enableErrorBoundaries) return;

    this.createErrorBoundary();
    this.initializeComponents();
    this.initializeManagers();
  }

  private createErrorBoundary(): void {
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

  private initializeComponents(): void {
    this.componentRegistry = new ComponentRegistry();
    this.eventManager = new EventManager();
    this.keyboardHandler = new KeyboardHandler();
  }

  private initializeManagers(): void {
    this.screenManager = new ScreenManager({
      enableTransitions: true,
      enableHistory: true,
      transitionDuration: 300,
      maxStackSize: 10,
      historySize: 50,
    });

    this.lifecycle = new LifecycleManager();
    this.applicationLoop = new ApplicationLoop(this.config.targetFPS);
  }

  private finalizeInitialization(startTime: number): void {
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
  }
}
