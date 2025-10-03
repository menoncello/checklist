import * as fs from 'fs/promises';
import { createLogger } from '@checklist/core/utils/logger';
import { PanicReport, PanicAction } from './PanicRecovery';
import { PanicRecoveryState } from './PanicRecoveryState';
import { PanicRecoveryStrategies } from './PanicRecoveryStrategies';

const logger = createLogger('checklist:tui:panic-recovery-execution');

export class PanicRecoveryExecution {
  private panicActions: PanicAction[] = [];

  constructor(
    private panicRecoveryState: PanicRecoveryState,
    private panicRecoveryStrategies: PanicRecoveryStrategies,
    private config: {
      enableCrashReports: boolean;
      crashReportPath: string;
    }
  ) {}

  public async handlePanic(
    error: Error,
    context: {
      component?: string;
      phase: string;
      severity?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<PanicReport> {
    const panicReport = this.createPanicReport(error, context);

    this.panicRecoveryState.incrementPanicCount();
    this.panicRecoveryState.addRecentPanic(panicReport);

    logger.error({
      msg: 'Panic recovery initiated',
      panicId: panicReport.id,
      error: error.message,
      panicCount: this.panicRecoveryState.getPanicCount(),
    });

    if (
      this.panicRecoveryState.shouldTriggerPanicMode(
        this.config.enableCrashReports ? 3 : 5,
        60000
      )
    ) {
      await this.enterPanicMode(panicReport);
    } else {
      await this.attemptPanicRecovery(panicReport);
    }

    return panicReport;
  }

  private async enterPanicMode(panicReport: PanicReport): Promise<void> {
    this.panicRecoveryState.setPanicMode(true);
    this.panicRecoveryState.incrementRecoveryAttempts();

    logger.error({
      msg: 'Entering panic mode',
      panicId: panicReport.id,
      panicCount: this.panicRecoveryState.getPanicCount(),
    });

    const panicModeActions = [
      'save_state',
      'restore_terminal',
      'graceful_shutdown',
      'emergency_exit',
    ];

    for (const action of panicModeActions) {
      const success =
        await this.panicRecoveryStrategies.executeStrategy(action);
      this.panicActions.push({
        type: action as PanicAction['type'],
        timestamp: Date.now(),
        success,
      });

      if (!success) {
        logger.error({
          msg: `Panic mode action failed: ${action}`,
          panicId: panicReport.id,
        });
      }
    }
  }

  private async attemptPanicRecovery(panicReport: PanicReport): Promise<void> {
    logger.info({
      msg: 'Attempting panic recovery',
      panicId: panicReport.id,
      panicCount: this.panicRecoveryState.getPanicCount(),
    });

    const recoveryStrategies = ['save_state', 'restore_terminal'];

    for (const strategy of recoveryStrategies) {
      const success =
        await this.panicRecoveryStrategies.executeStrategy(strategy);
      this.panicActions.push({
        type: strategy as PanicAction['type'],
        timestamp: Date.now(),
        success,
      });

      if (!success) {
        logger.error({
          msg: `Recovery strategy failed: ${strategy}`,
          panicId: panicReport.id,
        });
      }
    }
  }

  public async createCrashReportForPanic(
    panicReport: PanicReport
  ): Promise<void> {
    if (!this.config.enableCrashReports) {
      return;
    }

    try {
      await this.ensureCrashReportDirectory();
      const reportPath = this.getReportPath(panicReport.id);
      const crashReport = this.buildCrashReport(panicReport);

      await fs.writeFile(reportPath, JSON.stringify(crashReport, null, 2));

      logger.info({
        msg: 'Crash report created',
        panicId: panicReport.id,
        path: reportPath,
      });
    } catch (error) {
      logger.error({
        msg: 'Failed to create crash report',
        panicId: panicReport.id,
        error: (error as Error).message,
      });
    }
  }

  private async ensureCrashReportDirectory(): Promise<void> {
    await fs.mkdir(this.config.crashReportPath, { recursive: true });
  }

  private getReportPath(panicId: string): string {
    return `${this.config.crashReportPath}/panic-${panicId}.json`;
  }

  private buildCrashReport(panicReport: PanicReport) {
    return {
      panicId: panicReport.id,
      timestamp: panicReport.timestamp,
      error: {
        name: panicReport.error.name,
        message: panicReport.error.message,
        stack: panicReport.error.stack,
      },
      context: panicReport.context,
      recoveryAttempted: panicReport.recoveryAttempted,
      recoverySuccessful: panicReport.recoverySuccessful,
      actions: this.panicActions,
      systemInfo: this.getSystemInfo(),
    };
  }

  private getSystemInfo() {
    return {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
    };
  }

  public async handleFatalPanic(panicReport: PanicReport): Promise<void> {
    logger.error({
      msg: 'Handling fatal panic',
      panicId: panicReport.id,
      error: panicReport.error.message,
    });

    try {
      await this.executeFatalPanicActions(panicReport);
    } catch (error) {
      this.handleFatalPanicError(panicReport, error as Error);
    }
  }

  private async executeFatalPanicActions(
    panicReport: PanicReport
  ): Promise<void> {
    await this.createCrashReportForPanic(panicReport);

    const fatalActions = ['save_state', 'emergency_exit'];

    for (const action of fatalActions) {
      const success =
        await this.panicRecoveryStrategies.executeStrategy(action);
      this.panicActions.push({
        type: action as PanicAction['type'],
        timestamp: Date.now(),
        success,
      });

      if (!success) {
        logger.error({
          msg: `Fatal panic action failed: ${action}`,
          panicId: panicReport.id,
        });
      }
    }
  }

  private handleFatalPanicError(panicReport: PanicReport, error: Error): void {
    logger.error({
      msg: 'Fatal error during panic recovery',
      panicId: panicReport.id,
      error: error.message,
    });

    process.exit(1);
  }

  public getActions(): PanicAction[] {
    return [...this.panicActions];
  }

  public clearActions(): void {
    this.panicActions = [];
  }

  private createPanicReport(
    error: Error,
    context: {
      component?: string;
      phase: string;
      severity?: string;
      metadata?: Record<string, unknown>;
    }
  ): PanicReport {
    return {
      id: `panic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      error,
      context: {
        phase: context.phase,
        component: context.component ?? 'unknown',
        timestamp: Date.now(),
        severity:
          (context.severity as 'low' | 'medium' | 'high' | 'critical') ??
          'high',
        metadata: context.metadata,
      },
      recoveryAttempted: false,
      recoverySuccessful: false,
      actions: [],
    };
  }
}
