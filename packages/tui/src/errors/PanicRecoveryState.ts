import { PanicReport } from './PanicRecovery';

export interface PanicState {
  panicCount: number;
  lastPanicTime: number;
  inPanicMode: boolean;
  recoveryAttempts: number;
  recentPanics: PanicReport[];
}

export class PanicRecoveryState {
  private state: PanicState;

  constructor() {
    this.state = {
      panicCount: 0,
      lastPanicTime: 0,
      inPanicMode: false,
      recoveryAttempts: 0,
      recentPanics: [],
    };
  }

  public getState(): PanicState {
    return { ...this.state };
  }

  public setState(newState: Partial<PanicState>): void {
    this.state = { ...this.state, ...newState };
  }

  public incrementPanicCount(): void {
    this.state.panicCount++;
    this.state.lastPanicTime = Date.now();
  }

  public incrementRecoveryAttempts(): void {
    this.state.recoveryAttempts++;
  }

  public setPanicMode(inPanicMode: boolean): void {
    this.state.inPanicMode = inPanicMode;
  }

  public addRecentPanic(panic: PanicReport): void {
    this.state.recentPanics.push(panic);
    this.cleanupOldPanics();
  }

  public reset(): void {
    this.state = {
      panicCount: 0,
      lastPanicTime: 0,
      inPanicMode: false,
      recoveryAttempts: 0,
      recentPanics: [],
    };
  }

  private cleanupOldPanics(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.state.recentPanics = this.state.recentPanics.filter(
      (panic) => panic.timestamp > oneHourAgo
    );
  }

  public isInPanicMode(): boolean {
    return this.state.inPanicMode;
  }

  public getPanicCount(): number {
    return this.state.panicCount;
  }

  public getLastPanicTime(): number {
    return this.state.lastPanicTime;
  }

  public getRecoveryAttempts(): number {
    return this.state.recoveryAttempts;
  }

  public getRecentPanics(): PanicReport[] {
    return [...this.state.recentPanics];
  }

  public shouldTriggerPanicMode(
    maxPanicCount: number,
    panicWindowMs: number
  ): boolean {
    if (this.state.panicCount < maxPanicCount) {
      return false;
    }

    const timeSinceLastPanic = Date.now() - this.state.lastPanicTime;
    return timeSinceLastPanic < panicWindowMs;
  }

  public isPanicWindowExceeded(panicWindowMs: number): boolean {
    const timeSinceLastPanic = Date.now() - this.state.lastPanicTime;
    return timeSinceLastPanic >= panicWindowMs;
  }
}
