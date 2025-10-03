import { createLogger } from '@checklist/core/utils/logger';
import { ErrorBoundaryRenderer } from './ErrorBoundaryRenderer';

const logger = createLogger('checklist:tui:error-renderer');

export class ErrorRenderer {
  private fallbackRenderer: ErrorBoundaryRenderer;

  constructor(
    private config?: unknown,
    private stateManager?: unknown
  ) {
    this.fallbackRenderer = new ErrorBoundaryRenderer();
  }

  public renderError(
    state: {
      hasError: boolean;
      error: Error | null;
      errorInfo: Record<string, unknown> | null;
    },
    errorId?: string
  ): string {
    if (!state.hasError || !state.error) {
      return '';
    }

    logger.debug({
      msg: 'Rendering error boundary fallback',
      errorId,
      error: state.error.message,
    });

    return this.fallbackRenderer.render(state.error, state.errorInfo);
  }

  public renderRecoveryUI(
    retryCount: number,
    maxRetries: number,
    canRetry: boolean
  ): string {
    if (!canRetry) {
      return '\n\x1b[31mMaximum retry attempts reached. Please restart the application.\x1b[0m';
    }

    return `
\x1b[33mError Recovery UI\x1b[0m
Retry attempts: ${retryCount}/${maxRetries}
${retryCount < maxRetries ? '\x1b[32mRetrying...\x1b[0m' : '\x1b[31mCannot retry further\x1b[0m'}
    `.trim();
  }

  public renderErrorReport(report: {
    id: string;
    error: Error;
    severity: string;
    timestamp: number;
    recoveryAttempted: boolean;
    recoverySuccessful: boolean;
  }): string {
    return `
\x1b[31mError Report\x1b[0m
ID: ${report.id}
Error: ${report.error.message}
Severity: ${report.severity}
Time: ${new Date(report.timestamp).toISOString()}
Recovery: ${report.recoveryAttempted ? (report.recoverySuccessful ? 'Successful' : 'Failed') : 'Not attempted'}
    `.trim();
  }
}
