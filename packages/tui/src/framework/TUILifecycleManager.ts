import type { TUIFrameworkState } from '../TUIFramework';
import type { DebugIntegrationCore as DebugIntegration } from '../debug/DebugIntegrationCore';
import type { ErrorBoundary } from '../errors/ErrorBoundary';
import type { ApplicationLoop } from '../framework/ApplicationLoop';
import type { PerformanceManager } from '../performance/PerformanceManager';

interface TUIComponents {
  canvas?: unknown;
  applicationLoop?: ApplicationLoop;
  lifecycle?: unknown;
  screenManager?: unknown;
  componentRegistry?: unknown;
  eventManager?: unknown;
  keyboardHandler?: unknown;
  capabilityDetector?: unknown;
  errorBoundary?: ErrorBoundary;
  performanceManager?: PerformanceManager;
  debugIntegration?: DebugIntegration;
}

export class TUILifecycleManager {
  private isShuttingDown = false;

  constructor(
    private components: TUIComponents,
    private state: TUIFrameworkState,
    private emit: (event: string, data?: unknown) => void
  ) {}

  async start(): Promise<void> {
    if (!this.state.isInitialized) {
      throw new Error('Framework not initialized');
    }

    if (this.state.isRunning) {
      return;
    }

    this.logStartup();
    this.startPerformanceProfiling();
    await this.startApplicationLoop();
    this.completeStartup();
  }

  private logStartup(): void {
    this.components.debugIntegration?.log(
      'info',
      'Framework',
      'Starting TUI Framework'
    );
  }

  private startPerformanceProfiling(): void {
    if (this.components.performanceManager != null) {
      this.components.performanceManager.startBenchmark(
        'application_start',
        'Application startup'
      );
    }
  }

  private async startApplicationLoop(): Promise<void> {
    if (this.components.applicationLoop) {
      await this.components.applicationLoop.start();
    }
    this.state.isRunning = true;
  }

  private completeStartup(): void {
    if (this.components.performanceManager != null) {
      this.components.performanceManager.endBenchmark('application_start');
    }

    this.components.debugIntegration?.log(
      'info',
      'Framework',
      'TUI Framework started'
    );
    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.state.isRunning) return;

    this.components.debugIntegration?.log(
      'info',
      'Framework',
      'Stopping TUI Framework'
    );

    this.state.isRunning = false;
    if (this.components.applicationLoop) {
      await this.components.applicationLoop.stop();
    }

    this.components.debugIntegration?.log(
      'info',
      'Framework',
      'TUI Framework stopped'
    );
    this.emit('stopped');
  }

  async shutdown(signal?: string): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;
    this.logShutdownStart(signal);

    try {
      await this.stop();
      this.cleanupComponents();
      this.logShutdownComplete();
    } catch (error) {
      this.logShutdownError(error);
    }

    process.exit(0);
  }

  getShutdownState(): boolean {
    return this.isShuttingDown;
  }

  private logShutdownStart(signal?: string): void {
    this.components.debugIntegration?.log(
      'info',
      'Framework',
      `Shutting down TUI Framework (${signal ?? 'manual'})`
    );
  }

  private cleanupComponents(): void {
    this.destroyComponent(this.components.componentRegistry);
    this.destroyComponent(this.components.screenManager);
    this.destroyComponent(this.components.eventManager);
    this.components.performanceManager?.destroy();
    this.destroyComponent(this.components.canvas);
  }

  private destroyComponent(component: unknown): void {
    if (
      component !== null &&
      component !== undefined &&
      typeof component === 'object' &&
      'destroy' in component &&
      typeof (component as Record<string, unknown>).destroy === 'function'
    ) {
      ((component as Record<string, unknown>).destroy as () => void)();
    }
  }

  private logShutdownComplete(): void {
    this.components.debugIntegration?.log(
      'info',
      'Framework',
      'TUI Framework shutdown complete'
    );
  }

  private logShutdownError(error: unknown): void {
    this.components.debugIntegration?.log(
      'error',
      'Framework',
      'Error during shutdown',
      error
    );
  }
}
