/**
 * Signal handling utilities for LifecycleManager
 */

export class SignalHandler {
  private sigintHandler?: () => Promise<void>;
  private sigtermHandler?: () => Promise<void>;
  private uncaughtExceptionHandler?: (error: Error) => void;
  private unhandledRejectionHandler?: (reason: unknown) => void;

  constructor(
    private handleSignal: (signal: string) => Promise<void>,
    private handleUncaughtException: (error: Error) => void,
    private handleUnhandledRejection: (
      reason: unknown,
      promise?: Promise<unknown>
    ) => void
  ) {}

  public setupSignalHandlers(): void {
    this.sigintHandler = () => this.handleSignal('SIGINT');
    this.sigtermHandler = () => this.handleSignal('SIGTERM');

    process.on('SIGINT', this.sigintHandler);
    process.on('SIGTERM', this.sigtermHandler);

    this.uncaughtExceptionHandler = this.handleUncaughtException;
    this.unhandledRejectionHandler = this.handleUnhandledRejection;

    process.on('uncaughtException', this.uncaughtExceptionHandler);
    process.on('unhandledRejection', this.unhandledRejectionHandler);
  }

  public cleanupSignalHandlers(): void {
    if (this.sigintHandler) {
      process.off('SIGINT', this.sigintHandler);
    }
    if (this.sigtermHandler) {
      process.off('SIGTERM', this.sigtermHandler);
    }
    if (this.uncaughtExceptionHandler) {
      process.off('uncaughtException', this.uncaughtExceptionHandler);
    }
    if (this.unhandledRejectionHandler) {
      process.off('unhandledRejection', this.unhandledRejectionHandler);
    }
  }
}
