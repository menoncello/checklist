import { createLogger } from '@checklist/core/utils/logger';
import { ErrorBoundaryUtils } from './ErrorBoundaryUtils';

const logger = createLogger('checklist:tui:application-error-handler');

export type ApplicationErrorContext = {
  phase: string;
  component: string;
  timestamp: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
};

export type ApplicationErrorReport = {
  id: string;
  error: Error;
  context: ApplicationErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  recoveryAttempted: boolean;
  recoverySuccessful: boolean;
};

export class ApplicationErrorHandler {
  private reports: Map<string, ApplicationErrorReport> = new Map();

  constructor(
    private stateManager?: unknown,
    private historyManager?: unknown,
    private eventManager?: unknown
  ) {}

  public handleError(
    error: Error,
    context: ApplicationErrorContext
  ): ApplicationErrorReport {
    const errorId = ErrorBoundaryUtils.generateErrorId();
    const timestamp = Date.now();

    const severity = this.determineErrorSeverity(error, context);

    const report: ApplicationErrorReport = {
      id: errorId,
      error,
      context,
      severity,
      timestamp,
      recoveryAttempted: false,
      recoverySuccessful: false,
    };

    this.reports.set(errorId, report);

    this.logError(error, context, severity, errorId);

    return report;
  }

  public getReports(): Map<string, ApplicationErrorReport> {
    return new Map(this.reports);
  }

  public clearReports(): void {
    this.reports.clear();
    logger.debug({ msg: 'Application error reports cleared' });
  }

  public getReportCount(): number {
    return this.reports.size;
  }

  private determineErrorSeverity(
    error: Error,
    context: ApplicationErrorContext
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (context.severity) {
      return context.severity;
    }

    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      return 'high';
    }

    if (context.phase === 'initialization' || context.phase === 'shutdown') {
      return 'high';
    }

    if (error.message.includes('memory') || error.message.includes('disk')) {
      return 'critical';
    }

    return 'medium';
  }

  private logError(
    error: Error,
    context: ApplicationErrorContext,
    severity: string,
    errorId: string
  ): void {
    logger.error({
      msg: 'Application error occurred',
      errorId,
      error: error.message,
      severity,
      phase: context.phase,
      component: context.component,
      stack: error.stack,
    });
  }
}
