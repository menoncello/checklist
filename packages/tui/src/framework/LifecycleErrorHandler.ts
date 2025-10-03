/**
 * Error handling utilities for LifecycleManager
 */

import { LifecycleState } from './UIFramework';

export class ErrorHandler {
  constructor(
    private updatePhase: (phase: string) => void,
    private notifyStateChange: () => void,
    private updateErrorState: (error: Error) => void = () => {}
  ) {}

  public async handleError(
    error: Error,
    state: LifecycleState,
    errorHandlers: ((error: Error) => void)[]
  ): Promise<void> {
    state.errorState = error;

    for (const handler of errorHandlers) {
      try {
        handler(error);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    }

    // Update state to error
    this.updatePhase('error');
    this.notifyStateChange();
  }

  public handleUncaughtException(error: Error): void {
    console.error('Uncaught exception:', error);
    // Set error state and transition to error phase
    this.updateErrorState(error);
    this.updatePhase('error');
    this.notifyStateChange();
  }

  public handleUnhandledRejection(
    reason: unknown,
    promise?: Promise<unknown>
  ): void {
    const error =
      reason instanceof Error
        ? reason
        : new Error(`Unhandled Promise Rejection: ${String(reason)}`);
    console.error('Unhandled rejection at:', promise, 'reason:', error);
    // Set error state and transition to error phase
    this.updateErrorState(error);
    this.updatePhase('error');
    this.notifyStateChange();
  }
}
