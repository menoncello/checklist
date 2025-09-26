import { EventEmitter } from 'events';

export class StatePreservationEventManager extends EventEmitter {
  emitStateChange(state: unknown): void {
    this.emit('stateChange', state);
  }

  emitError(error: Error): void {
    this.emit('error', error);
  }

  emitRecovery(recoveredState: unknown): void {
    this.emit('recovery', recoveredState);
  }

  onStateChange(callback: (state: unknown) => void): void {
    this.on('stateChange', callback);
  }

  onError(callback: (error: Error) => void): void {
    this.on('error', callback);
  }

  onRecovery(callback: (recoveredState: unknown) => void): void {
    this.on('recovery', callback);
  }
}
