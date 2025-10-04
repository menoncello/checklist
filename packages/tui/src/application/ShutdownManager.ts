import { createLogger } from '@checklist/core/utils/logger';
import { EventBus } from '../events/EventBus';
import { LifecycleManager, LifecycleHooks } from '../framework/Lifecycle';

import {
  ShutdownManagerConfig,
  ShutdownConfigManager,
} from './ShutdownConfigManager';
import { ShutdownContextManager } from './ShutdownContextManager';
import { ShutdownEventHandlers } from './ShutdownEventHandlers';
import { ShutdownExecution } from './ShutdownExecution';
import { ShutdownHandlerManager } from './ShutdownHandlerManager';
import { ShutdownReporter } from './ShutdownReporter';
import { ShutdownSignalHandler } from './ShutdownSignalHandler';
import { ShutdownStepManager } from './ShutdownStepManager';
import { ShutdownStep, ShutdownSteps } from './ShutdownSteps';
import { ShutdownTimers } from './ShutdownTimers';

const logger = createLogger('checklist:tui:shutdown-manager');

export interface ShutdownContext {
  startTime: number;
  timeout: number;
  steps: ShutdownStep[];
  completedSteps: Set<string>;
  failedSteps: Map<string, Error>;
  forceShutdown: boolean;
}

export interface ShutdownReport {
  duration: number;
  stepsCompleted: number;
  stepsFailed: number;
  steps: Array<{
    id: string;
    name: string;
    status: 'completed' | 'failed' | 'skipped';
    duration?: number;
    error?: string;
  }>;
  forceShutdown: boolean;
  timeoutReached: boolean;
}

export class ShutdownManager implements LifecycleHooks {
  private config: ShutdownManagerConfig;
  private eventBus: EventBus;
  private shutdownContext: ShutdownContext | null = null;
  private shutdownSteps: ShutdownSteps;
  private shutdownExecution: ShutdownExecution;
  private shutdownReporter: ShutdownReporter;
  private handlerManager: ShutdownHandlerManager;
  private stepManager: ShutdownStepManager;
  private configManager: ShutdownConfigManager;
  private eventHandlers: ShutdownEventHandlers;
  private timers: ShutdownTimers;
  private contextManager: ShutdownContextManager;
  private signalHandler: ShutdownSignalHandler;

  constructor(config: Partial<ShutdownManagerConfig> = {}) {
    this.configManager = new ShutdownConfigManager(config);
    this.config = this.configManager.getConfig();

    this.eventBus = new EventBus();
    this.shutdownSteps = new ShutdownSteps();
    this.shutdownExecution = new ShutdownExecution(this.eventBus);
    this.shutdownReporter = new ShutdownReporter();
    this.handlerManager = new ShutdownHandlerManager();
    this.stepManager = new ShutdownStepManager();
    this.stepManager.setSteps(this.getDefaultCleanupOrder());

    this.eventHandlers = new ShutdownEventHandlers(
      this.eventBus,
      this.shutdownExecution,
      this.stepManager
    );
    this.timers = new ShutdownTimers();
    this.contextManager = new ShutdownContextManager(
      this.shutdownExecution,
      this.stepManager,
      this.shutdownReporter
    );
    this.signalHandler = new ShutdownSignalHandler(async (reason: string) => {
      await this.executeGracefulShutdown(reason);
    });

    this.setupEventHandlers();
  }

  private getDefaultCleanupOrder(): ShutdownStep[] {
    return this.shutdownSteps.getDefaultCleanupOrder();
  }

  private setupEventHandlers(): void {
    this.eventHandlers.setupEventHandlers();
  }

  public async onInitialize(): Promise<void> {
    logger.info({ msg: 'Initializing Shutdown Manager' });

    try {
      this.setupSignalHandlers();
      logger.info({ msg: 'Shutdown Manager initialized successfully' });
    } catch (error) {
      logger.error({
        msg: 'Failed to initialize Shutdown Manager',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  public async onShutdown(): Promise<void> {
    logger.info({ msg: 'Shutting down Shutdown Manager' });

    try {
      this.cleanupSignalHandlers();
      this.shutdownExecution.cleanup();
      this.eventBus.destroy();
      this.handlerManager.clear();
      logger.info({ msg: 'Shutdown Manager shutdown complete' });
    } catch (error) {
      logger.error({
        msg: 'Error during Shutdown Manager shutdown',
        error: (error as Error).message,
      });
    }
  }

  private setupSignalHandlers(): void {
    this.signalHandler.setupSignalHandlers();
  }

  private cleanupSignalHandlers(): void {
    this.signalHandler.cleanupSignalHandlers();
  }

  public registerHooks(lifecycleManager: LifecycleManager): void {
    lifecycleManager.registerHooks(this);
  }

  public async executeGracefulShutdown(
    reason: string = 'unknown'
  ): Promise<ShutdownReport> {
    if (this.shutdownContext !== null) {
      logger.warn({ msg: 'Shutdown already in progress' });
      return this.createShutdownReport();
    }

    logger.info({
      msg: 'Starting graceful shutdown',
      reason,
      timeout: this.config.timeout,
    });

    this.shutdownContext = this.createShutdownContext();

    try {
      this.publishShutdownStarted(reason);
      await this.executeShutdownSteps();
      const report = this.createShutdownReport();
      this.publishShutdownCompleted(report);
      this.logShutdownCompletion(report);
      return report;
    } catch (error) {
      const report = this.createShutdownReport();
      this.publishShutdownError(error as Error, report);
      return report;
    } finally {
      this.shutdownContext = null;
      this.clearTimers();
    }
  }

  private createShutdownContext(): ShutdownContext {
    return this.contextManager.createShutdownContext(this.config.timeout);
  }

  private publishShutdownStarted(reason: string): void {
    this.eventHandlers.publishShutdownStarted(reason);
  }

  private publishShutdownCompleted(report: ShutdownReport): void {
    this.eventHandlers.publishShutdownCompleted(report);
  }

  private logShutdownCompletion(report: ShutdownReport): void {
    logger.info({
      msg: 'Graceful shutdown completed',
      duration: report.duration,
      stepsCompleted: report.stepsCompleted,
      stepsFailed: report.stepsFailed,
    });
  }

  private publishShutdownError(error: Error, report: ShutdownReport): void {
    logger.error({
      msg: 'Error during graceful shutdown',
      error: error.message,
    });
    this.eventHandlers.publishShutdownError(error, report);
  }

  private async executeShutdownSteps(): Promise<void> {
    if (!this.shutdownContext) {
      throw new Error('No shutdown context available');
    }

    await this.contextManager.executeShutdownSteps(
      this.shutdownContext,
      () => this.startTimeoutTimer(),
      () => this.clearTimers()
    );
  }

  private startTimeoutTimer(): void {
    if (!this.shutdownContext) {
      return;
    }

    this.timers.startTimeoutTimer(this.shutdownContext.timeout, () => {
      logger.warn({
        msg: 'Shutdown timeout reached, initiating force shutdown',
        timeout: this.shutdownContext?.timeout,
      });

      if (this.shutdownContext) {
        this.shutdownContext.forceShutdown = true;
      }

      this.startForceKillTimer();

      this.eventBus.publish('shutdown:timeout', {
        context: this.shutdownContext,
        timestamp: Date.now(),
      });
    });
  }

  private startForceKillTimer(): void {
    this.timers.startForceKillTimer(this.config.forceKillTimeout, () => {
      logger.error({ msg: 'Force kill timeout reached, exiting process' });
      process.exit(1);
    });
  }

  private clearTimers(): void {
    this.timers.clearTimers();
  }

  private createShutdownReport(): ShutdownReport {
    if (this.shutdownContext === null) {
      throw new Error('Shutdown context not initialized');
    }
    return this.contextManager.createShutdownReport(this.shutdownContext);
  }

  private handleShutdownRequest(request: {
    force?: boolean;
    reason?: string;
  }): void {
    if (request.force === true) {
      logger.warn({
        msg: 'Force shutdown requested',
        reason: request.reason ?? 'unknown',
      });
      process.exit(1);
    } else {
      const reason = request.reason ?? 'unknown';
      this.executeGracefulShutdown(reason);
    }
  }

  public addShutdownHandler(id: string, executor: () => Promise<void>): void {
    this.handlerManager.addHandler(id, executor);
  }

  public removeShutdownHandler(id: string): boolean {
    return this.handlerManager.removeHandler(id);
  }

  public addCleanupStep(step: ShutdownStep): void {
    this.stepManager.addStep(step);
  }

  public removeCleanupStep(stepId: string): boolean {
    return this.stepManager.removeStep(stepId);
  }

  public isShutdownInProgress(): boolean {
    return this.shutdownContext !== null;
  }

  public getShutdownContext(): ShutdownContext | null {
    return this.shutdownContext ? { ...this.shutdownContext } : null;
  }

  public getConfig(): ShutdownManagerConfig {
    return this.configManager.getConfig();
  }

  public updateConfig(newConfig: Partial<ShutdownManagerConfig>): void {
    this.configManager.updateConfig(newConfig);
    this.config = this.configManager.getConfig();
  }

  public getEventBus(): EventBus {
    return this.eventBus;
  }
}
