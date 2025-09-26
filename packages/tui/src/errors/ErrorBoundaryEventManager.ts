import { EventEmitter } from 'events';

export interface ErrorEvent {
  error: Error;
  timestamp: Date;
  context?: unknown;
}

export interface RecoveryEvent {
  previousError: Error;
  recoveryMethod: string;
  timestamp: Date;
}

export class ErrorBoundaryEventManager extends EventEmitter {
  emitError(error: Error, context?: unknown): void {
    const event: ErrorEvent = {
      error,
      timestamp: new Date(),
      context,
    };
    this.emit('error', event);
  }

  emitRecovery(previousError: Error, recoveryMethod: string): void {
    const event: RecoveryEvent = {
      previousError,
      recoveryMethod,
      timestamp: new Date(),
    };
    this.emit('recovery', event);
  }

  emitReset(): void {
    this.emit('reset');
  }

  onError(callback: (event: ErrorEvent) => void): void {
    this.on('error', callback);
  }

  onRecovery(callback: (event: RecoveryEvent) => void): void {
    this.on('recovery', callback);
  }

  onReset(callback: () => void): void {
    this.on('reset', callback);
  }
}
