import { createLogger } from '@checklist/core/utils/logger';
import { ErrorBoundary } from '../errors/ErrorBoundary';
import { PanicRecovery } from '../errors/PanicRecovery';
import { ApplicationLoop } from '../framework/ApplicationLoop';
import { LifecycleManager } from '../framework/Lifecycle';
import { InputRouter } from '../input/InputRouter';
import { SplitPaneLayout } from '../layout/SplitPaneLayout';
import { PerformanceMonitor } from '../performance/PerformanceMonitor';
import { TerminalManager } from '../terminal/TerminalManager';
import { ApplicationShellConfig } from './ApplicationShellConfig';
import { ShutdownManager } from './ShutdownManager';

const logger = createLogger('checklist:tui:application-shell-startup');

export interface ApplicationShellStartupConfig {
  config: ApplicationShellConfig;
  errorBoundary: ErrorBoundary;
  panicRecovery: PanicRecovery;
  lifecycleManager: LifecycleManager;
  performanceMonitor: PerformanceMonitor;
}

export class ApplicationShellStartup {
  private config: ApplicationShellConfig;
  private errorBoundary: ErrorBoundary;
  private panicRecovery: PanicRecovery;
  private lifecycleManager: LifecycleManager;
  private performanceMonitor: PerformanceMonitor;

  constructor(config: ApplicationShellStartupConfig) {
    this.config = config.config;
    this.errorBoundary = config.errorBoundary;
    this.panicRecovery = config.panicRecovery;
    this.lifecycleManager = config.lifecycleManager;
    this.performanceMonitor = config.performanceMonitor;
  }

  public async initializeSubsystems(
    terminalManager: TerminalManager,
    splitPaneLayout: SplitPaneLayout,
    inputRouter: InputRouter,
    shutdownManager: ShutdownManager
  ): Promise<void> {
    await terminalManager.initialize();
    await splitPaneLayout.initialize();
    await inputRouter.onInitialize();
    await shutdownManager.onInitialize();
  }

  public recordStartupMetrics(startupStartTime: number): void {
    const startupDuration = performance.now() - startupStartTime;
    this.performanceMonitor.recordMetricValue('startup_time', startupDuration, {
      phase: 'initialization',
    });

    if (startupDuration > 100) {
      logger.warn({
        msg: 'Application startup exceeds 100ms threshold',
        duration: startupDuration,
      });
    }
  }

  public async handleInitializationError(error: Error): Promise<void> {
    await this.panicRecovery.handlePanic(error, {
      phase: 'initialization',
      component: 'application-shell',
      timestamp: Date.now(),
    });
  }

  public async start(
    applicationLoop: ApplicationLoop,
    renderCallback: () => void
  ): Promise<void> {
    logger.info({ msg: 'Starting Application Shell' });

    try {
      await this.errorBoundary.execute(async () => {
        applicationLoop.setRenderCallback(renderCallback);
        applicationLoop.start();
        this.lifecycleManager.registerComponent('application-shell');
      });
    } catch (error) {
      await this.panicRecovery.handlePanic(error as Error, {
        phase: 'startup',
        component: 'application-shell',
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  public async stop(applicationLoop: ApplicationLoop): Promise<void> {
    logger.info({ msg: 'Stopping Application Shell' });

    try {
      await this.errorBoundary.execute(async () => {
        applicationLoop.stop();
      });
    } catch (error) {
      await this.panicRecovery.handlePanic(error as Error, {
        phase: 'shutdown',
        component: 'application-shell',
        timestamp: Date.now(),
      });
      throw error;
    }
  }
}
