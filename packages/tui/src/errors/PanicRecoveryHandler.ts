import { createLogger } from '@checklist/core/utils/logger';
import { ErrorBoundary } from './ErrorBoundary';
import { PanicReport } from './PanicRecovery';

const logger = createLogger('checklist:tui:panic-recovery-handler');

export class PanicRecoveryHandler {
  private panicHandlers: Map<string, (panic: PanicReport) => void> = new Map();

  constructor(private errorBoundary: ErrorBoundary) {
    this.setupGlobalPanicHandlers();
  }

  private setupGlobalPanicHandlers(): void {
    this.setupExceptionHandler();
    this.setupRejectionHandler();
    this.setupCriticalErrorHandler();
    this.setupMemoryErrorHandler();
  }

  private setupExceptionHandler(): void {
    this.panicHandlers.set('uncaught_exception', (panic) => {
      logger.error({
        msg: 'Uncaught exception triggered panic recovery',
        panicId: panic.id,
        error: panic.error.message,
      });

      this.errorBoundary.handleApplicationError(panic.error, panic.context);
    });
  }

  private setupRejectionHandler(): void {
    this.panicHandlers.set('unhandled_rejection', (panic) => {
      logger.error({
        msg: 'Unhandled promise rejection triggered panic recovery',
        panicId: panic.id,
        error: panic.error.message,
      });

      this.errorBoundary.handleApplicationError(panic.error, panic.context);
    });
  }

  private setupCriticalErrorHandler(): void {
    this.panicHandlers.set('critical_error', (panic) => {
      logger.error({
        msg: 'Critical error triggered panic recovery',
        panicId: panic.id,
        error: panic.error.message,
      });

      this.errorBoundary.handleApplicationError(panic.error, panic.context);
    });
  }

  private setupMemoryErrorHandler(): void {
    this.panicHandlers.set('memory_error', (panic) => {
      logger.error({
        msg: 'Memory error triggered panic recovery',
        panicId: panic.id,
        error: panic.error.message,
      });

      this.errorBoundary.handleApplicationError(panic.error, panic.context);
    });
  }

  public handlePanic(handlerType: string, panic: PanicReport): void {
    const handler = this.panicHandlers.get(handlerType);
    if (handler) {
      handler(panic);
    } else {
      logger.error({
        msg: 'Unknown panic handler type',
        handlerType,
        panicId: panic.id,
      });
    }
  }

  public getAvailableHandlers(): string[] {
    return Array.from(this.panicHandlers.keys());
  }

  public registerHandler(
    handlerType: string,
    handler: (panic: PanicReport) => void
  ): void {
    this.panicHandlers.set(handlerType, handler);
    logger.debug({
      msg: 'Panic handler registered',
      handlerType,
    });
  }

  public unregisterHandler(handlerType: string): void {
    this.panicHandlers.delete(handlerType);
    logger.debug({
      msg: 'Panic handler unregistered',
      handlerType,
    });
  }
}
