import { createLogger } from '@checklist/core/utils/logger';
import { ShutdownContext, ShutdownReport } from './ShutdownManager';
import { ShutdownStep } from './ShutdownSteps';

export interface ExecutionContext {
  startTime: number;
  timeout: number;
  steps: ShutdownStep[];
  completedSteps: Set<string>;
  failedSteps: Map<string, Error>;
  forceShutdown: boolean;
}

const _logger = createLogger('checklist:tui:shutdown-context');

export class ShutdownContextManager {
  constructor(
    private shutdownExecution: {
      executeGracefulShutdown: (context: ExecutionContext) => Promise<void>;
    },
    private stepManager: { getSteps: () => ShutdownStep[] },
    private shutdownReporter: {
      generateReport: (context: ShutdownContext) => ShutdownReport;
    }
  ) {}

  public createShutdownContext(timeout: number): ShutdownContext {
    return {
      startTime: Date.now(),
      timeout,
      steps: this.stepManager.getSteps(),
      completedSteps: new Set(),
      failedSteps: new Map(),
      forceShutdown: false,
    };
  }

  public convertToExecutionContext(context: ShutdownContext): ExecutionContext {
    return {
      startTime: context.startTime,
      timeout: context.timeout,
      steps: context.steps,
      completedSteps: context.completedSteps,
      failedSteps: context.failedSteps,
      forceShutdown: context.forceShutdown,
    };
  }

  public updateContextFromExecution(
    shutdownContext: ShutdownContext,
    executionContext: ExecutionContext
  ): void {
    shutdownContext.completedSteps = executionContext.completedSteps;
    shutdownContext.failedSteps = executionContext.failedSteps;
    shutdownContext.forceShutdown = executionContext.forceShutdown;
  }

  public createShutdownReport(
    shutdownContext: ShutdownContext
  ): ShutdownReport {
    return this.shutdownReporter.generateReport(shutdownContext);
  }

  public async executeShutdownSteps(
    shutdownContext: ShutdownContext,
    startTimeoutTimer: () => void,
    clearTimers: () => void
  ): Promise<void> {
    startTimeoutTimer();
    const executionContext = this.convertToExecutionContext(shutdownContext);
    await this.shutdownExecution.executeGracefulShutdown(executionContext);
    this.updateContextFromExecution(shutdownContext, executionContext);
    clearTimers();
  }
}
