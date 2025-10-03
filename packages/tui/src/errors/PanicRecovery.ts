import { createLogger } from '@checklist/core/utils/logger';
import type { ApplicationShell } from '../application/ApplicationShell';
import { LifecycleManager, LifecycleHooks } from '../framework/Lifecycle';
import { ErrorBoundary, ApplicationErrorContext } from './ErrorBoundary';
import { PanicRecoveryExecution } from './PanicRecoveryExecution';
import { PanicRecoveryHandler } from './PanicRecoveryHandler';
import { PanicRecoveryState } from './PanicRecoveryState';
import { PanicRecoveryStrategies } from './PanicRecoveryStrategies';

// Use type-only import to avoid circular dependency

const logger = createLogger('checklist:tui:panic-recovery');

export interface PanicRecoveryConfig {
  maxPanicCount: number;
  panicWindowMs: number;
  enableCrashReports: boolean;
  crashReportPath: string;
  enableAutoRestart: boolean;
  maxRestartAttempts: number;
  fallbackModeEnabled: boolean;
}

export interface PanicReport {
  id: string;
  timestamp: number;
  error: Error;
  context: ApplicationErrorContext;
  recoveryAttempted: boolean;
  recoverySuccessful: boolean;
  crashReportPath?: string;
  actions: PanicAction[];
}

export interface PanicAction {
  type:
    | 'save_state'
    | 'cleanup'
    | 'restore_terminal'
    | 'graceful_shutdown'
    | 'emergency_exit';
  timestamp: number;
  success: boolean;
  details?: string;
  error?: string;
}

export class PanicRecovery implements LifecycleHooks {
  private config: PanicRecoveryConfig;
  private errorBoundary: ErrorBoundary;
  private applicationShell?: ApplicationShell;
  private panicRecoveryState: PanicRecoveryState;
  private panicRecoveryHandler: PanicRecoveryHandler;
  private panicRecoveryStrategies: PanicRecoveryStrategies;
  private panicRecoveryExecution: PanicRecoveryExecution;
  private uncaughtExceptionHandler?: (error: Error) => void;
  private unhandledRejectionHandler?: (reason: unknown) => void;
  private sigusr1Handler?: () => void;

  constructor(
    errorBoundary: ErrorBoundary,
    config: Partial<PanicRecoveryConfig> = {}
  ) {
    this.config = {
      maxPanicCount: 3,
      panicWindowMs: 60000, // 1 minute
      enableCrashReports: true,
      crashReportPath: './crash-reports',
      enableAutoRestart: false,
      maxRestartAttempts: 3,
      fallbackModeEnabled: true,
      ...config,
    };

    this.errorBoundary = errorBoundary;
    this.panicRecoveryState = new PanicRecoveryState();
    this.panicRecoveryHandler = new PanicRecoveryHandler(errorBoundary);
    this.panicRecoveryStrategies = new PanicRecoveryStrategies(errorBoundary);
    this.panicRecoveryExecution = new PanicRecoveryExecution(
      this.panicRecoveryState,
      this.panicRecoveryStrategies,
      {
        enableCrashReports: this.config.enableCrashReports,
        crashReportPath: this.config.crashReportPath,
      }
    );
  }

  public setApplicationShell(applicationShell: ApplicationShell): void {
    this.applicationShell = applicationShell;
  }

  public async onInitialize(): Promise<void> {
    logger.info({ msg: 'Initializing Panic Recovery' });

    try {
      this.setupGlobalPanicHandlers();
      this.setupErrorBoundaryIntegration();

      logger.info({ msg: 'Panic Recovery initialized successfully' });
    } catch (error) {
      logger.error({
        msg: 'Failed to initialize Panic Recovery',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  public async onShutdown(): Promise<void> {
    logger.info({ msg: 'Shutting down Panic Recovery' });

    try {
      this.cleanupGlobalHandlers();

      logger.info({ msg: 'Panic Recovery shutdown complete' });
    } catch (error) {
      logger.error({
        msg: 'Error during Panic Recovery shutdown',
        error: (error as Error).message,
      });
    }
  }

  public registerHooks(lifecycleManager: LifecycleManager): void {
    lifecycleManager.registerHooks(this);
  }

  private setupGlobalPanicHandlers(): void {
    this.createExceptionHandler();
    this.createRejectionHandler();
    this.createSignalHandler();
    this.registerProcessHandlers();
  }

  private createExceptionHandler(): void {
    this.uncaughtExceptionHandler = (error: Error) => {
      this.handlePanic(error, {
        phase: 'running',
        component: 'process',
        timestamp: Date.now(),
        severity: 'critical',
      });
    };
  }

  private createRejectionHandler(): void {
    this.unhandledRejectionHandler = (reason: unknown) => {
      const error =
        reason instanceof Error ? reason : new Error(String(reason));
      this.handlePanic(error, {
        phase: 'running',
        component: 'promise',
        timestamp: Date.now(),
        severity: 'critical',
      });
    };
  }

  private createSignalHandler(): void {
    this.sigusr1Handler = () => {
      this.handlePanic(new Error('Out of memory detected'), {
        phase: 'running',
        component: 'memory',
        timestamp: Date.now(),
        severity: 'critical',
      });
    };
  }

  private registerProcessHandlers(): void {
    if (this.uncaughtExceptionHandler) {
      process.on('uncaughtException', this.uncaughtExceptionHandler);
    }
    if (this.unhandledRejectionHandler) {
      process.on('unhandledRejection', this.unhandledRejectionHandler);
    }

    if (this.sigusr1Handler) {
      process.on('SIGUSR1', this.sigusr1Handler);
    }
  }

  private cleanupGlobalHandlers(): void {
    if (this.uncaughtExceptionHandler) {
      process.off('uncaughtException', this.uncaughtExceptionHandler);
      this.uncaughtExceptionHandler = undefined;
    }

    if (this.unhandledRejectionHandler) {
      process.off('unhandledRejection', this.unhandledRejectionHandler);
      this.unhandledRejectionHandler = undefined;
    }

    if (this.sigusr1Handler && typeof process.off === 'function') {
      process.off('SIGUSR1', this.sigusr1Handler);
      this.sigusr1Handler = undefined;
    }
  }

  private setupErrorBoundaryIntegration(): void {
    this.errorBoundary.on('criticalError', (data: unknown) => {
      const report = data as PanicReport;
      this.handlePanic(report.error, report.context);
    });
  }

  public async handlePanic(
    error: Error,
    context: ApplicationErrorContext
  ): Promise<PanicReport> {
    return await this.panicRecoveryExecution.handlePanic(error, context);
  }

  public async createCrashReportForPanic(
    panicReport: PanicReport
  ): Promise<void> {
    await this.panicRecoveryExecution.createCrashReportForPanic(panicReport);
  }

  public async handleFatalPanic(panicReport: PanicReport): Promise<void> {
    await this.panicRecoveryExecution.handleFatalPanic(panicReport);
  }

  public getState() {
    return this.panicRecoveryState.getState();
  }

  public getAvailableStrategies(): string[] {
    return this.panicRecoveryStrategies.getAvailableStrategies();
  }

  public getAvailableHandlers(): string[] {
    return this.panicRecoveryHandler.getAvailableHandlers();
  }

  public registerHandler(
    handlerType: string,
    handler: (panic: PanicReport) => void
  ): void {
    this.panicRecoveryHandler.registerHandler(handlerType, handler);
  }

  public unregisterHandler(handlerType: string): void {
    this.panicRecoveryHandler.unregisterHandler(handlerType);
  }
}
